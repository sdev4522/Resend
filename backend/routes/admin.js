const router = require("express").Router();
const { query } = require("../database/dbpromise.js");
const { prisma, sanitizeBigInt } = require("../database/prisma.js");
const con = require("../database/config.js");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const { sign, verify: verifyJwt } = require("jsonwebtoken");
const adminValidator = require("../middlewares/admin.js");
const {
  updateUserPlan,
  getFileExtension,
  sendEmail,
  isValidEmail,
  testMongoConnection,
} = require("../functions/function.js");
const moment = require("moment");
const { recoverEmail } = require("../emails/returnEmails.js");
const {
  sendFcmPushNotification,
} = require("../helper/addon/web-notification/webPush.js");
const logger = require("../utils/logger.js");
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");
const { authRateLimiter } = require("../middlewares/rateLimiter.js");
const { getGoogleAuthConfig } = require("../helper/googleAuth.js");

function getQrHelper() {
  return require("../helper/addon/qr/index.js");
}

// Writes an admin_audit_logs row. Never throws: auditing must not break the action.
async function audit(req, action, targetType, targetId, details = null) {
  try {
    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details, ip_address) VALUES (?,?,?,?,?,?)`,
      [
        req.decode?.uid || "admin",
        action,
        targetType,
        targetId != null ? String(targetId) : null,
        details ? JSON.stringify(details) : null,
        String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 100) || null,
      ],
    );
  } catch (err) {
    logger.error("[admin audit] failed to write log:", err.message);
  }
}

// Keeps every plan_prices row of a plan on the plan's billing period. Rows left on an
// old period (after the duration changed) are moved, or dropped when the currency
// already has a row on the current period. Trial plans are always free.
async function alignPlanPrices(planId, periodDays, isTrial) {
  const days = parseInt(periodDays || 30, 10);
  const stale = await query(
    `SELECT id, currency_code FROM plan_prices WHERE plan_id = ? AND billing_period_days <> ?`,
    [planId, days],
  );
  for (const row of stale) {
    const [current] = await query(
      `SELECT id FROM plan_prices WHERE plan_id = ? AND currency_code = ? AND billing_period_days = ? LIMIT 1`,
      [planId, row.currency_code, days],
    );
    if (current) {
      await query(`DELETE FROM plan_prices WHERE id = ?`, [row.id]);
    } else {
      await query(`UPDATE plan_prices SET billing_period_days = ?, updated_at = NOW() WHERE id = ?`, [days, row.id]);
    }
  }
  if (isTrial) {
    await query(`UPDATE plan_prices SET amount = 0, strike_amount = NULL, updated_at = NOW() WHERE plan_id = ?`, [planId]);
  }
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}


router.post("/login", authRateLimiter({ limit: 10, prefix: "admin_login" }), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        msg: "Please fill email and password",
      });
    }

    const cleanEmail = email.toString().toLowerCase().trim();

    const userFind = await query(`SELECT * FROM admin WHERE email = ?`, [
      cleanEmail,
    ]);
    if (userFind.length < 1) {
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", msg: "Invalid credentials" });
    }

    const compare = await bcrypt.compare(password, userFind[0].password);
    if (!compare) {
      return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", msg: "Invalid credentials" });
    }

    // ✅ tokenVersion in payload — NO password in token, 24h expiration
    const token = sign(
      {
        uid: userFind[0].uid,
        role: "admin",
        email: userFind[0].email,
        tokenVersion: userFind[0].tokenVersion ?? 0,
      },
      process.env.JWTKEY,
      { expiresIn: "24h" },
    );

    res.json({ success: true, token });
  } catch (err) {
    logger.error("[Admin Login Error]", err);
    res.status(500).json({ success: false, code: "INTERNAL_ERROR", msg: "Internal server error" });
  }
});

router.post("/logout", adminValidator, async (req, res) => {
  try {
    await query(
      `UPDATE admin SET tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE uid = ?`,
      [req.decode.uid],
    );
    return res.json({ success: true, msg: "Logged out successfully" });
  } catch (err) {
    logger.error("[Admin Logout Error]", err);
    return res.status(500).json({ success: false, msg: "Logout failed" });
  }
});

// add new plan
router.post("/add_plan", adminValidator, async (req, res) => {
  try {
    const {
      title,
      short_description,
      allow_tag,
      allow_note,
      allow_chatbot,
      contact_limit,
      allow_api,
      is_trial,
      price,
      price_strike,
      plan_duration_in_days,
      qr_account,
      wa_warmer,
      rest_api_qr,
      instagram_inbox,
      telegram_inbox,
      allow_wa_forms,
      messenger_inbox,
      custom,
    } = req.body;

    if (!title || !short_description || !plan_duration_in_days) {
      return res.json({ success: false, msg: "Please fill details" });
    }
    const priceNum = parseMoney(price);
    const strikeNum = parseMoney(price_strike);
    if (Number.isNaN(priceNum) || Number.isNaN(strikeNum)) {
      return res.json({ success: false, msg: "Price must be a positive number" });
    }
    if (!(parseInt(plan_duration_in_days, 10) > 0)) {
      return res.json({ success: false, msg: "Plan duration must be at least 1 day" });
    }

    const customVal = custom ? (typeof custom === "object" ? JSON.stringify(custom) : String(custom)) : null;

    const insertRes = await query(
      `INSERT INTO plan (title, short_description, allow_tag, allow_note, allow_chatbot, 
        contact_limit, allow_api, is_trial, price, price_strike, plan_duration_in_days, 
        qr_account, wa_warmer, rest_api_qr, instagram_inbox, telegram_inbox, allow_wa_forms, messenger_inbox, custom) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        short_description,
        allow_tag ? 1 : 0,
        allow_note ? 1 : 0,
        allow_chatbot ? 1 : 0,
        parseInt(contact_limit || 0),
        allow_api ? 1 : 0,
        is_trial ? 1 : 0,
        is_trial ? 0 : priceNum || 0,
        is_trial ? null : strikeNum,
        parseInt(plan_duration_in_days || 1),
        parseInt(qr_account) > 0 ? parseInt(qr_account) : 0,
        wa_warmer ? 1 : 0,
        rest_api_qr ? 1 : 0,
        instagram_inbox ? 1 : 0,
        telegram_inbox ? 1 : 0,
        allow_wa_forms ? 1 : 0,
        messenger_inbox ? 1 : 0,
        customVal,
      ],
    );

    if (insertRes?.insertId) {
      await query(
        `INSERT INTO plan_prices (plan_id, currency_code, amount, strike_amount, billing_period_days, is_active, updated_at)
         VALUES (?, 'USD', ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE 
           amount = VALUES(amount), 
           strike_amount = VALUES(strike_amount), 
           billing_period_days = VALUES(billing_period_days),
           updated_at = NOW()`,
        [
          insertRes.insertId,
          is_trial ? 0 : priceNum || 0,
          is_trial ? null : strikeNum,
          parseInt(plan_duration_in_days || 30, 10),
        ]
      );
      await audit(req, "PLAN_CREATE", "PLAN", insertRes.insertId, { title, price: is_trial ? 0 : priceNum, days: plan_duration_in_days });
    }

    res.json({ success: true, msg: "Plan has been added" });
  } catch (err) {
    res.json({ success: false, msg: "Something went wrong" });
    logger.log(err);
  }
});

// update existing plan
router.post("/update_plan_data", adminValidator, async (req, res) => {
  try {
    const {
      id,
      title,
      short_description,
      allow_tag,
      allow_note,
      allow_chatbot,
      contact_limit,
      allow_api,
      is_trial,
      price,
      price_strike,
      plan_duration_in_days,
      qr_account,
      wa_warmer,
      rest_api_qr,
      instagram_inbox,
      telegram_inbox,
      allow_wa_forms,
      messenger_inbox,
      custom,
    } = req.body;

    if (!id) return res.json({ success: false, msg: "Plan ID is required" });
    if (!title || !short_description || !plan_duration_in_days)
      return res.json({ success: false, msg: "Please fill all details" });
    const priceNum = parseMoney(price);
    const strikeNum = parseMoney(price_strike);
    if (Number.isNaN(priceNum) || Number.isNaN(strikeNum)) {
      return res.json({ success: false, msg: "Price must be a positive number" });
    }
    if (!(parseInt(plan_duration_in_days, 10) > 0)) {
      return res.json({ success: false, msg: "Plan duration must be at least 1 day" });
    }

    const customVal = custom ? (typeof custom === "object" ? JSON.stringify(custom) : String(custom)) : null;

    await query(
      `UPDATE plan SET 
        title = ?, short_description = ?, allow_tag = ?, allow_note = ?,
        allow_chatbot = ?, contact_limit = ?, allow_api = ?, is_trial = ?,
        price = ?, price_strike = ?, plan_duration_in_days = ?,
        qr_account = ?, wa_warmer = ?, rest_api_qr = ?,
        instagram_inbox = ?, telegram_inbox = ?,
        allow_wa_forms = ?, messenger_inbox = ?, custom = ?
       WHERE id = ?`,
      [
        title,
        short_description,
        allow_tag ? 1 : 0,
        allow_note ? 1 : 0,
        allow_chatbot ? 1 : 0,
        parseInt(contact_limit || 0),
        allow_api ? 1 : 0,
        is_trial ? 1 : 0,
        is_trial ? 0 : priceNum || 0,
        is_trial ? null : strikeNum,
        parseInt(plan_duration_in_days || 1),
        parseInt(qr_account) > 0 ? parseInt(qr_account) : 0,
        wa_warmer ? 1 : 0,
        rest_api_qr ? 1 : 0,
        instagram_inbox ? 1 : 0,
        telegram_inbox ? 1 : 0,
        allow_wa_forms ? 1 : 0,
        messenger_inbox ? 1 : 0,
        customVal,
        id,
      ],
    );

    // Sync USD row in plan_prices
    await query(
      `INSERT INTO plan_prices (plan_id, currency_code, amount, strike_amount, billing_period_days, is_active, updated_at)
       VALUES (?, 'USD', ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE 
         amount = VALUES(amount), 
         strike_amount = VALUES(strike_amount), 
         billing_period_days = VALUES(billing_period_days),
         updated_at = NOW()`,
      [
        id,
        is_trial ? 0 : priceNum || 0,
        is_trial ? null : strikeNum,
        parseInt(plan_duration_in_days || 30, 10),
      ]
    );
    await alignPlanPrices(id, plan_duration_in_days, Boolean(is_trial));
    await audit(req, "PLAN_UPDATE", "PLAN", id, { title, price: is_trial ? 0 : priceNum, days: plan_duration_in_days, is_trial: Boolean(is_trial) });

    res.json({ success: true, msg: "Plan updated successfully" });
  } catch (err) {
    res.json({ success: false, msg: "Something went wrong" });
    logger.log(err);
  }
});

// get plans
router.get("/get_plans", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM plan`, []);
    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get web public
router.get("/get_web_public", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM web_public`, []);
    res.json({ data: data[0], success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del plan
router.post("/del_plan", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.json({ success: false, msg: "Plan ID is required" });
    }

    // Safety check: verify no active users are currently assigned this plan
    const assignedUsers = await query(
      `SELECT COUNT(*) as count FROM user WHERE JSON_EXTRACT(plan, '$.id') = ?`,
      [Number(id)]
    );
    const count = assignedUsers[0]?.count || 0;
    if (count > 0) {
      return res.status(400).json({
        success: false,
        msg: `Cannot delete plan: This plan is currently assigned to ${count} active user(s). Please reassign them to another plan first.`,
      });
    }

    await query(`DELETE FROM plan_prices WHERE plan_id = ?`, [id]);
    await query(`DELETE FROM plan WHERE id = ?`, [id]);
    await audit(req, "PLAN_DELETE", "PLAN", id);
    res.json({ success: true, msg: "Plan was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all users (supports optional server-side pagination & search)
// get all users (supports optional server-side pagination, search & email verification status)
router.get("/get_users", adminValidator, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit))) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const emailStatusFilter = req.query.email_status ? String(req.query.email_status).trim().toLowerCase() : null;

    let sql = `
      SELECT 
        u.id, u.role, u.uid, u.name, u.email, u.mobile_with_country_code, 
        u.timezone, u.plan, u.plan_expire, u.trial, u.createdAt, 
        u.tokenVersion, u.subscription_id, u.subscription_status, u.is_blocked, 
        u.email_verified_at,
        (SELECT COUNT(*) FROM email_verification ev WHERE ev.email = u.email AND ev.used_at IS NULL AND ev.expires_at > NOW()) as pending_verification_count
      FROM user u
    `;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(u.name LIKE ? OR u.email LIKE ? OR u.mobile_with_country_code LIKE ? OR u.uid LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY u.id DESC`;

    if (limit) {
      const offset = (page - 1) * limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const rawData = await query(sql, params);

    // Compute authoritative email_status for every user
    const data = rawData.map((u) => {
      let emailStatus = "unverified";
      if (u.email_verified_at !== null) {
        emailStatus = "verified";
      } else if (Number(u.pending_verification_count || 0) > 0) {
        emailStatus = "pending";
      } else if (u.createdAt && new Date(u.createdAt) < new Date("2026-09-23T00:00:00.000Z")) {
        emailStatus = "unknown";
      } else {
        emailStatus = "unverified";
      }

      const { pending_verification_count: _, ...cleanUser } = u;
      return {
        ...cleanUser,
        email_status: emailStatus,
      };
    });

    const filteredData = emailStatusFilter && ["verified", "unverified", "pending", "unknown"].includes(emailStatusFilter)
      ? data.filter((u) => u.email_status === emailStatusFilter)
      : data;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ data: filteredData, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "something went wrong", err });
  }
});

// get detailed user inspector for admin
router.get("/get_user_details", adminValidator, async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, msg: "User UID is required" });
    }

    const rawUsers = await query(
      `SELECT u.id, u.role, u.uid, u.name, u.email, u.mobile_with_country_code, u.timezone, u.plan, u.plan_expire, u.trial, u.createdAt, u.subscription_id, u.subscription_status, u.is_blocked, u.email_verified_at,
        (SELECT COUNT(*) FROM email_verification ev WHERE ev.email = u.email AND ev.used_at IS NULL AND ev.expires_at > NOW()) as pending_verification_count 
       FROM user u WHERE u.uid = ?`,
      [uid]
    );

    if (rawUsers.length === 0) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const userRaw = rawUsers[0];
    let emailStatus = "unverified";
    if (userRaw.email_verified_at !== null) {
      emailStatus = "verified";
    } else if (Number(userRaw.pending_verification_count || 0) > 0) {
      emailStatus = "pending";
    } else if (userRaw.createdAt && new Date(userRaw.createdAt) < new Date("2026-09-23T00:00:00.000Z")) {
      emailStatus = "unknown";
    } else {
      emailStatus = "unverified";
    }

    const { pending_verification_count: _, ...user } = userRaw;
    user.email_status = emailStatus;

    // Related counts & lists
    const [instances, contacts, campaigns, flows, chatbots, orders] = await Promise.all([
      query(`SELECT id, title, number, uniqueId, status, createdAt FROM instance WHERE uid = ?`, [uid]),
      query(`SELECT COUNT(*) as count FROM contact WHERE uid = ?`, [uid]),
      query(`SELECT id, title, status, total_contacts, sent_count, delivered_count, failed_count, createdAt FROM beta_campaign WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
      query(`SELECT id, flow_id, name, source, createdAt FROM beta_flows WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
      query(`SELECT id, title, active, createdAt FROM beta_chatbot WHERE uid = ? ORDER BY id DESC`, [uid]),
      query(`SELECT id, amount, status, payment_mode, data, createdAt FROM orders WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
    ]);

    let parsedPlan = null;
    try {
      parsedPlan = user.plan ? (typeof user.plan === "string" ? JSON.parse(user.plan) : user.plan) : null;
    } catch (_) {}

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          parsedPlan,
        },
        stats: {
          instancesCount: instances.length,
          contactsCount: contacts[0]?.count || 0,
          campaignsCount: campaigns.length,
          flowsCount: flows.length,
          chatbotsCount: chatbots.length,
          ordersCount: Number((await query(`SELECT COUNT(*) AS c FROM orders WHERE uid = ?`, [uid]))[0]?.c || 0),
        },
        instances,
        recentCampaigns: campaigns,
        recentFlows: flows,
        chatbots,
        recentOrders: orders,
      },
    });
  } catch (err) {
    logger.error("get_user_details error:", err);
    res.status(500).json({ success: false, msg: "Failed to load user details", error: err.message });
  }
});

// block or unblock user account
router.post("/toggle_user_status", adminValidator, async (req, res) => {
  try {
    const { uid, is_blocked } = req.body;
    if (!uid || is_blocked === undefined) {
      return res.status(400).json({ success: false, msg: "UID and is_blocked boolean required" });
    }

    const blockedVal = is_blocked ? 1 : 0;

    const user = await prisma.user.findFirst({
      where: { uid },
      select: { uid: true, email: true, name: true, tokenVersion: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const nextTokenVersion = (user.tokenVersion || 0) + 1;

    // Atomic transaction for user status update + admin audit log
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { uid },
        data: {
          is_blocked: Boolean(blockedVal),
          tokenVersion: nextTokenVersion,
        },
      });
      await tx.admin_audit_logs.create({
        data: {
          admin_uid: req.decode?.uid || "admin",
          action: blockedVal ? "USER_BLOCK" : "USER_UNBLOCK",
          target_type: "USER",
          target_id: uid,
          details: JSON.stringify({ email: user.email, name: user.name, is_blocked: blockedVal }),
        },
      });
    });

    res.json({
      success: true,
      msg: blockedVal ? `User ${user.email} has been suspended` : `User ${user.email} has been unblocked`,
      is_blocked: blockedVal,
    });
  } catch (err) {
    logger.error("toggle_user_status error:", err);
    res.status(500).json({ success: false, msg: "Failed to update user status", error: err.message });
  }
});

// update user by admin
router.post("/update_user", adminValidator, async (req, res) => {
  try {
    const { newPassword, name, mobile_with_country_code, uid } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!uid || !name || !email || !mobile_with_country_code) {
      return res.json({
        success: false,
        msg: "You forgot to enter some field(s)",
      });
    }
    if (!isValidEmail(email)) {
      return res.json({ success: false, msg: "Please enter a valid email" });
    }
    if (newPassword && (typeof newPassword !== "string" || newPassword.length < 8)) {
      return res.json({ success: false, msg: "Password must be at least 8 characters" });
    }

    const findUserByEmail = await prisma.user.findFirst({
      where: { email },
    });

    if (findUserByEmail && findUserByEmail.uid !== uid) {
      return res.json({
        success: false,
        msg: "This email is already taken by another user",
      });
    }

    const findUserByUid = await prisma.user.findFirst({
      where: { uid },
    });

    if (!findUserByUid) {
      return res.json({
        success: false,
        msg: "User not found",
      });
    }

    if (newPassword) {
      const hashpass = await bcrypt.hash(newPassword, 10);
      const nextTokenVersion = (findUserByUid.tokenVersion || 0) + 1;

      await prisma.user.updateMany({
        where: { uid },
        data: {
          name,
          email,
          password: hashpass,
          mobile_with_country_code,
          tokenVersion: nextTokenVersion,
        },
      });
    } else {
      await prisma.user.updateMany({
        where: { uid },
        data: {
          name,
          email,
          mobile_with_country_code,
        },
      });
    }

    await audit(req, newPassword ? "USER_UPDATE_WITH_PASSWORD" : "USER_UPDATE", "USER", uid, {
      name,
      email,
      emailChanged: findUserByUid.email !== email,
      passwordReset: Boolean(newPassword),
    });

    res.json({ msg: "User was updated", success: true });
  } catch (err) {
    logger.log(err);
    res.json({
      success: false,
      msg: "Something went wrong",
      error: err.message,
    });
  }
});

// update plan
router.post("/update_plan", adminValidator, async (req, res) => {
  try {
    const { plan, uid, extend, customDays } = req.body;

    if (!plan || !uid) {
      return res.json({ success: false, msg: "Invalid input provided" });
    }

    const getPlan = await query(`SELECT * FROM plan WHERE id = ?`, [plan?.id]);
    if (getPlan.length < 1) {
      return res.json({ success: false, msg: "Invalid plan found" });
    }
    const [target] = await query(`SELECT uid, plan, plan_expire FROM user WHERE uid = ?`, [uid]);
    if (!target) {
      return res.json({ success: false, msg: "User not found" });
    }
    const days = customDays ? parseInt(customDays, 10) : null;
    if (customDays && !(days > 0 && days <= 3650)) {
      return res.json({ success: false, msg: "Custom days must be between 1 and 3650" });
    }

    // extend=true (default) keeps remaining days when the user already has this plan active
    await updateUserPlan(getPlan[0], uid, days, extend !== false);

    // Admin grants are not payments, but record them so billing history and the
    // subscriptions view show where the plan came from.
    const { getCurrencySettings } = require("../helper/pricing");
    const { baseCode } = await getCurrencySettings();
    if (Number(getPlan[0].is_trial) !== 1) {
      await prisma.orders.create({
        data: {
          uid,
          payment_mode: "ADMIN_GRANT",
          amount: "0.00",
          status: "paid",
          s_token: `admin_${String(uid).slice(0, 8)}_${Date.now()}`,
          data: JSON.stringify({
            plan: getPlan[0],
            currency: baseCode,
            grantedBy: req.decode?.uid || "admin",
            durationDays: days || Number(getPlan[0].plan_duration_in_days) || null,
          }),
        },
      });
    }
    await audit(req, "USER_PLAN_GRANT", "USER", uid, {
      planId: getPlan[0].id,
      planTitle: getPlan[0].title,
      customDays: days,
      extend: extend !== false,
      previousExpire: target.plan_expire || null,
    });

    res.json({ success: true, msg: "User plan was updated" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get payment gateway admin
router.get("/get_payment_gateway_admin", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM web_private`, []);
    if (data.length < 1) {
      return res.json({ data: {}, success: true });
    }
    res.json({ data: data[0], success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// update payment gateway
router.post("/update_pay_gateway", adminValidator, async (req, res) => {
  try {
    const {
      pay_offline_id,
      pay_offline_key,
      offline_active,
      pay_stripe_id,
      pay_stripe_key,
      stripe_active,
      pay_paypal_id,
      pay_paypal_key,
      paypal_active,
      rz_id,
      rz_key,
      rz_active,
      pay_paystack_id,
      pay_paystack_key,
      paystack_active,
      // ✅ MERCADOPAGO FIELDS ADDED
      pay_mercadopago_public_key,
      pay_mercadopago_access_token,
      mercadopago_active,
    } = req.body;

    await query(
      `UPDATE web_private SET  
            pay_offline_id = ?, 
            pay_offline_key = ?, 
            offline_active = ?,
            pay_stripe_id = ?, 
            pay_stripe_key = ?, 
            stripe_active = ?,
            pay_paypal_id = ?,
            pay_paypal_key = ?,
            paypal_active = ?,
            rz_id = ?,
            rz_key = ?,
            rz_active = ?,
            pay_paystack_id = ?,
            pay_paystack_key = ?,
            paystack_active = ?,
            pay_mercadopago_public_key = ?,
            pay_mercadopago_access_token = ?,
            mercadopago_active = ?
            `,
      [
        pay_offline_id,
        pay_offline_key,
        offline_active,
        pay_stripe_id,
        pay_stripe_key,
        stripe_active,
        pay_paypal_id,
        pay_paypal_key,
        paypal_active,
        rz_id,
        rz_key,
        rz_active,
        pay_paystack_id,
        pay_paystack_key,
        paystack_active,
        // ✅ MERCADOPAGO VALUES ADDED
        pay_mercadopago_public_key,
        pay_mercadopago_access_token,
        mercadopago_active,
      ],
    );

    res.json({ success: true, msg: "Payment gateway updated" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get razorpay settings
router.get("/get_razorpay_settings", adminValidator, async (req, res) => {
  try {
    const [webPrivate] = await query(
      `SELECT rz_id, rz_key, rz_active, rz_webhook_secret FROM web_private LIMIT 1`
    );
    const hasKey = Boolean(
      (process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET !== "") ||
        (webPrivate?.rz_key && webPrivate.rz_key !== "xxxxxxxxxxxxxxxxx" && webPrivate.rz_key !== "")
    );
    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      (webPrivate?.rz_id && webPrivate.rz_id !== "xxxxxxxxxxxxxxxxx" ? webPrivate.rz_id : "");
    const webhookFromEnv = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
    const hasWebhookSecret = webhookFromEnv || Boolean(webPrivate?.rz_webhook_secret);

    // Secrets never leave the server; the form shows whether one is set
    res.json({
      success: true,
      data: {
        rz_id: keyId,
        rz_active: webPrivate?.rz_active == "1",
        has_rz_key: hasKey,
        has_webhook_secret: hasWebhookSecret,
        webhook_secret_from_env: webhookFromEnv,
        rz_webhook_secret: "",
      },
    });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to get Razorpay settings" });
  }
});

// update razorpay settings
router.post("/update_razorpay_settings", adminValidator, async (req, res) => {
  try {
    const { rz_id, rz_key, rz_active, rz_webhook_secret } = req.body;
    // Blank secret fields mean "keep the current value" (the form never receives them)
    const sets = ["rz_id = ?", "rz_active = ?"];
    const params = [rz_id ? String(rz_id).trim() : "", rz_active ? "1" : "0"];
    if (rz_key && String(rz_key).trim() !== "") {
      sets.push("rz_key = ?");
      params.push(String(rz_key).trim());
    }
    if (rz_webhook_secret && String(rz_webhook_secret).trim() !== "") {
      sets.push("rz_webhook_secret = ?");
      params.push(String(rz_webhook_secret).trim());
    }
    await query(`UPDATE web_private SET ${sets.join(", ")}`, params);
    await audit(req, "RAZORPAY_SETTINGS_UPDATE", "SETTINGS", "razorpay", {
      rz_id: params[0],
      active: Boolean(rz_active),
      keyChanged: sets.includes("rz_key = ?"),
      webhookSecretChanged: sets.includes("rz_webhook_secret = ?"),
    });

    res.json({ success: true, msg: "Razorpay settings updated successfully" });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to update Razorpay settings" });
  }
});

// get currency settings for admin
router.get("/currency_settings", adminValidator, async (req, res) => {
  try {
    const { getCurrencySettings } = require("../helper/pricing");
    const settings = await getCurrencySettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to get currency settings" });
  }
});

// update currency settings for admin
router.post("/update_currency_settings", adminValidator, async (req, res) => {
  try {
    const { baseCode, baseSymbol, baseExchangeRate, supportedCurrencies } = req.body;

    if (!baseCode || !baseSymbol) {
      return res.json({ success: false, msg: "Base currency code and symbol are required" });
    }

    const cleanCode = baseCode.trim().toUpperCase();
    const cleanSymbol = baseSymbol.trim();
    const cleanRate = String(parseFloat(baseExchangeRate || 1.0) || 1.0);

    // Save multi-currency array in web_public.other as JSON
    let otherData = {};
    const [existing] = await query(`SELECT other FROM web_public LIMIT 1`);
    if (existing?.other && typeof existing.other === "string") {
      try {
        otherData = JSON.parse(existing.other);
      } catch (_) {}
    }

    if (Array.isArray(supportedCurrencies)) {
      otherData.supported_currencies = supportedCurrencies;
    }
    if (req.body.roundingMode) {
      otherData.rounding_mode = req.body.roundingMode;
    }

    const otherJson = JSON.stringify(otherData);

    await query(
      `UPDATE web_public SET currency_code = ?, currency_symbol = ?, exchange_rate = ?, other = ? WHERE id = 1`,
      [cleanCode, cleanSymbol, cleanRate, otherJson]
    );

    await audit(req, "CURRENCY_SETTINGS_UPDATE", "SETTINGS", "currency", {
      baseCode: cleanCode,
      baseSymbol: cleanSymbol,
      currencies: Array.isArray(supportedCurrencies) ? supportedCurrencies.map((c) => c.code) : undefined,
    });
    res.json({ success: true, msg: "Currency settings updated successfully" });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to update currency settings" });
  }
});

// get plan prices matrix for admin
router.get("/plan_prices", adminValidator, async (req, res) => {
  try {
    const { getCurrencySettings, PPP_BENCHMARKS } = require("../helper/pricing");
    const plans = await query(
      `SELECT id, title, price, price_strike, plan_duration_in_days, is_trial FROM plan ORDER BY is_trial ASC, price ASC`
    );
    const prices = await query(`SELECT * FROM plan_prices ORDER BY plan_id, currency_code`);
    const currencySettings = await getCurrencySettings();

    res.json({
      success: true,
      plans,
      prices,
      currencySettings,
      pppBenchmarks: PPP_BENCHMARKS,
    });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to get plan prices" });
  }
});

// update plan prices matrix for admin (bulk upsert)
router.post("/update_plan_prices", adminValidator, async (req, res) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.json({ success: false, msg: "Prices array is required" });
    }

    const planRows = await query(`SELECT id, plan_duration_in_days, is_trial FROM plan`);
    const planById = new Map(planRows.map((p) => [Number(p.id), p]));
    const touchedPlans = new Set();
    let saved = 0;
    let skipped = 0;

    for (const item of prices) {
      const planId = parseInt(item.plan_id, 10);
      const plan = planById.get(planId);
      const currencyCode = (item.currency_code || "").trim().toUpperCase();
      let amount = parseMoney(item.amount);
      let strikeAmount = parseMoney(item.strike_amount);
      const isActive = item.is_active === false ? 0 : 1;

      if (!plan || !/^[A-Z]{3}$/.test(currencyCode) || amount === null || Number.isNaN(amount) || Number.isNaN(strikeAmount)) {
        skipped++;
        continue;
      }
      // Prices always belong to the plan's own billing period; trials are free
      const billingDays = parseInt(plan.plan_duration_in_days || 30, 10);
      if (Number(plan.is_trial) === 1) {
        amount = 0;
        strikeAmount = null;
      }
      touchedPlans.add(planId);
      saved++;

      await query(
        `INSERT INTO plan_prices (plan_id, currency_code, amount, strike_amount, billing_period_days, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           amount = VALUES(amount),
           strike_amount = VALUES(strike_amount),
           billing_period_days = VALUES(billing_period_days),
           is_active = VALUES(is_active),
           updated_at = NOW()`,
        [planId, currencyCode, amount, strikeAmount, billingDays, isActive]
      );

      // If updating USD, keep base plan.price and plan.price_strike synced for backwards compatibility
      if (currencyCode === "USD") {
        await query(
          `UPDATE plan SET price = ?, price_strike = ? WHERE id = ?`,
          [amount, strikeAmount, planId]
        );
      }
    }

    for (const planId of touchedPlans) {
      const plan = planById.get(planId);
      await alignPlanPrices(planId, plan.plan_duration_in_days, Number(plan.is_trial) === 1);
    }
    await audit(req, "PLAN_PRICES_UPDATE", "PLAN", [...touchedPlans].join(","), { saved, skipped });

    res.json({
      success: true,
      msg: skipped
        ? `Saved ${saved} price(s); skipped ${skipped} invalid row(s)`
        : "Plan prices matrix saved successfully",
    });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to update plan prices" });
  }
});

// suggest PPP prices endpoint for admin
router.post("/suggest_ppp_prices", adminValidator, async (req, res) => {
  try {
    const { suggestPppPrices } = require("../helper/pricing");
    const { usdPrice, strikeMultiplier } = req.body;

    if (usdPrice === undefined || usdPrice === null) {
      return res.json({ success: false, msg: "USD price is required" });
    }

    const suggestions = suggestPppPrices(
      parseFloat(usdPrice) || 0,
      parseFloat(strikeMultiplier) || 2.5
    );
    res.json({ success: true, suggestions });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to generate PPP suggestions" });
  }
});

// get all payment orders for admin
router.get("/get_payment_orders", adminValidator, async (req, res) => {
  try {
    const orders = await query(
      `SELECT o.id, o.uid, o.payment_mode, o.amount, o.data, o.s_token, o.status, o.createdAt, u.email as user_email, u.name as user_name 
       FROM orders o 
       LEFT JOIN user u ON o.uid = u.uid 
       ORDER BY o.createdAt DESC LIMIT 500`
    );

    const { getCurrencySettings } = require("../helper/pricing");
    const { baseCode } = await getCurrencySettings();

    const formatted = orders.map((o) => {
      let parsedData = null;
      try {
        parsedData = JSON.parse(o.data);
      } catch (e) {
        parsedData = { raw: o.data };
      }

      return {
        id: o.id,
        uid: o.uid,
        userEmail: o.user_email || "Unknown User",
        userName: o.user_name || "Customer",
        paymentMode: o.payment_mode,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt,
        referenceId: o.s_token,
        planTitle: parsedData?.plan?.title || "Plan",
        isAutopay: Boolean(parsedData?.isAutopay),
        currency: String(parsedData?.currency || baseCode).toUpperCase(),
        razorpayPaymentId: parsedData?.razorpayPaymentId || null,
      };
    });

    res.json({ success: true, orders: formatted, baseCurrency: baseCode });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "Failed to fetch payment orders" });
  }
});

// add partners logo
router.post("/add_brand_image", adminValidator, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.json({ success: false, msg: "No files were uploaded" });
    }

    const randomString = randomstring.generate();
    const file = req.files.file;

    const filename = `${randomString}.${getFileExtension(file.name)}`;

    file.mv(`${__dirname}/../client/public/media/${filename}`, (err) => {
      if (err) {
        logger.log(err);
        return res.json({ err });
      }
    });

    await query(`INSERT INTO partners (filename) VALUES (?)`, [filename]);

    res.json({ success: true, msg: "Logo was uploaded" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all brands
router.get("/get_brands", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM partners`, []);
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del image
router.post("/del_brand_logo", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE from partners WHERE id = ?`, [id]);

    res.json({ success: true, msg: "Bran was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// add faq
router.post("/add_faq", adminValidator, async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!answer || !question) {
      return res.json({
        success: false,
        msg: "Please provide question and answer both",
      });
    }

    await prisma.faq.create({
      data: {
        question,
        answer,
      },
    });

    res.json({ success: true, msg: "Faq was added" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all faq
router.get("/get_faq", async (req, res) => {
  try {
    const data = await prisma.faq.findMany();
    res.json({ data: sanitizeBigInt(data), success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del faq
router.post("/del_faq", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await prisma.faq.deleteMany({
      where: { id: parseInt(id, 10) },
    });
    res.json({ success: true, msg: "Faq was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// add page
router.post("/add_page", adminValidator, async (req, res) => {
  try {
    const { title, content, slug } = req.body;

    if (!title || !content || !slug) {
      return res.json({ success: false, msg: "Please fill all fields" });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.json({ success: false, msg: "No image was selected" });
    }

    // checking few pages
    const pageAlready = [
      "contact-form",
      "privacy-policy",
      "terms-and-conditions",
    ];

    if (pageAlready.includes(slug)) {
      return res.json({
        msg: "This slug is already used by system please use another slug.",
      });
    }

    // checking already one
    const getPage = await query(`SELECT * FROM page WHERE slug = ?`, [slug]);
    if (getPage.length > 0) {
      return res.json({
        success: false,
        msg: "Thi slug was already used by another page.",
      });
    }

    const randomString = randomstring.generate();
    const file = req.files.file;

    const filename = `${randomString}.${getFileExtension(file.name)}`;

    file.mv(`${__dirname}/../client/public/media/${filename}`, (err) => {
      if (err) {
        logger.log(err);
        return res.json({ err });
      }
    });

    await query(
      `INSERT INTO page (slug, title, image, content) VALUES (?,?,?,?)`,
      [slug, title, filename, content],
    );

    res.json({ success: true, msg: "Page was added" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all pages
router.get("/get_pages", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM page WHERE permanent = ?`, [0]);
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del page
router.post("/del_page", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;

    await query(`DELETE FROM page WHERE id = ?`, [id]);
    res.json({ success: true, msg: "Page was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

router.post("/auto_login", adminValidator, async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.json({ success: false, msg: "Invalid input" });
    }

    const targetUser = await prisma.user.findFirst({
      where: { uid },
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // MED-03: Admin auto-login impersonation token expires in 1h with audit log
    const token = sign(
      {
        uid: targetUser.uid,
        role: "user",
        email: targetUser.email,
        tokenVersion: targetUser.tokenVersion ?? 0,
        impersonatedBy: req.decode?.uid || "admin",
      },
      process.env.JWTKEY,
      { expiresIn: "1h" },
    );

    logger.log(`[ADMIN AUDIT] Admin ${req.decode?.uid || "unknown"} generated impersonation token for user ${targetUser.uid}`);
    await audit(req, "USER_IMPERSONATE", "USER", targetUser.uid, { email: targetUser.email, expiresIn: "1h" });
    res.json({ success: true, token });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// ading testtimonial
router.post("/add_testimonial", adminValidator, async (req, res) => {
  try {
    const { title, description, reviewer_name, reviewer_position } = req.body;

    if (!title || !description || !reviewer_name || !reviewer_position) {
      return res.json({ success: false, msg: "Please fill all fields" });
    }

    await prisma.testimonial.create({
      data: {
        title,
        description,
        reviewer_name,
        reviewer_position,
      },
    });

    res.json({ success: true, msg: "Testimonial was added" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get all testi
router.get("/get_testi", async (req, res) => {
  try {
    const data = await prisma.testimonial.findMany();
    res.json({ success: true, data: sanitizeBigInt(data) });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// del testi
router.post("/del_testi", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;

    await prisma.testimonial.deleteMany({
      where: { id: parseInt(id, 10) },
    });
    res.json({ success: true, msg: "Testimonial was deleted" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get orders
router.get("/get_orders", adminValidator, async (req, res) => {
  try {
    const data = await query(
      `
            SELECT 
                orders.id,
                orders.uid,
                orders.payment_mode,
                orders.amount,
                orders.status,
                orders.data,
                orders.s_token,
                orders.createdAt AS orderCreatedAt,
                user.role,
                user.name,
                user.email,
                user.mobile_with_country_code,
                user.timezone,
                user.plan,
                user.plan_expire,
                user.trial,
                user.api_key,
                user.createdAt AS userCreatedAt
            FROM orders
            LEFT JOIN user ON orders.uid = user.uid
        `,
      [],
    );

    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

router.post("/del_order", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM orders WHERE id = ?`, [id]);
    res.json({ msg: "Order enter was deleted", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get all contact forms
router.get("/get_contact_leads", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM contact_form`, []);
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// del contact entry
router.post("/del_cotact_entry", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM contact_form WHERE id = ?`, [id]);
    res.json({ success: true, msg: "Entry was deleted" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get page by slug
router.post("/get_page_slug", async (req, res) => {
  try {
    const { slug } = req.body;

    const data = await query(`SELECT * FROM page WHERE slug = ?`, [slug]);
    if (data.length < 1) {
      return res.json({ data: {}, success: true, page: false });
    } else {
      return res.json({ data: data[0], success: true, page: true });
    }
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// update termns
router.post("/update_terms", adminValidator, async (req, res) => {
  try {
    const { title, content } = req.body;

    // check
    const getPP = await query(`SELECT * FROM page WHERE slug = ?`, [
      "terms-and-conditions",
    ]);

    if (getPP.length > 0) {
      await query(`UPDATE page SET title = ?, content = ? WHERE slug = ?`, [
        title,
        content,
        "terms-and-conditions",
      ]);
    } else {
      await query(
        `INSERT INTO page (slug, title, content, permanent) VALUES (?,?,?,?)`,
        ["terms-and-conditions", title, content, 1],
      );
    }

    res.json({ success: true, msg: "Page updated" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// update privacy policy
router.post("/update_privacy_policy", adminValidator, async (req, res) => {
  try {
    const { title, content } = req.body;

    // check
    const getPP = await query(`SELECT * FROM page WHERE slug = ?`, [
      "privacy-policy",
    ]);

    if (getPP.length > 0) {
      await query(`UPDATE page SET title = ?, content = ? WHERE slug = ?`, [
        title,
        content,
        "privacy-policy",
      ]);
    } else {
      await query(
        `INSERT INTO page (slug, title, content, permanent) VALUES (?,?,?,?)`,
        ["privacy-policy", title, content, 1],
      );
    }

    res.json({ success: true, msg: "Page updated" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get smtp
router.get("/get_smtp", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT id, email, host, port, username, password, createdAt FROM smtp`, []);
    if (data.length < 1) {
      return res.json({ 
        data: { 
          id: "", 
          email: "", 
          host: "", 
          port: "587", 
          username: "", 
          has_password: false, 
          password: "" 
        }, 
        success: true 
      });
    } else {
      const config = data[0];
      const hasPassword = Boolean(config.password && String(config.password).trim().length > 0);
      return res.json({ 
        data: {
          id: config.id,
          email: config.email,
          from_email: config.email,
          host: config.host,
          port: config.port,
          username: config.username,
          has_password: hasPassword,
          password: hasPassword ? "••••••••••••" : "",
          createdAt: config.createdAt,
        }, 
        success: true 
      });
    }
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "server error", err });
  }
});

// update smtp
router.post("/update_smtp", adminValidator, async (req, res) => {
  try {
    const host = req.body.host;
    const port = req.body.port;
    const password = req.body.password;
    const username = req.body.username;
    const email = req.body.email || req.body.from_email;

    if (!email || !port || !host || !username) {
      return res.json({ success: false, msg: "Please fill email, host, port, and username" });
    }

    const getOne = await query(`SELECT * FROM smtp`, []);
    let finalPassword = password;

    // If password is blank or mask, preserve existing stored password
    if (!finalPassword || finalPassword === "••••••••••••") {
      if (getOne.length > 0 && getOne[0].password) {
        finalPassword = getOne[0].password;
      } else {
        return res.json({ success: false, msg: "Password is required for SMTP configuration" });
      }
    }

    if (getOne.length < 1) {
      await query(
        `INSERT INTO smtp (email, host, port, password, username) VALUES (?,?,?,?,?)`,
        [email, host, port, finalPassword, username],
      );
    } else {
      await query(
        `UPDATE smtp SET email = ?, host = ?, port = ?, password = ?, username = ?`,
        [email, host, port, finalPassword, username],
      );
    }

    // Log admin audit
    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
      [req.decode?.uid || "admin", "SMTP_UPDATE", "SETTINGS", "smtp", JSON.stringify({ email, host, port, username })]
    );

    res.json({ success: true, msg: "Email settings updated successfully" });
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: "server error", err });
  }
});

// send test email
router.post("/send_test_email", adminValidator, async (req, res) => {
  try {
    const host = req.body.host;
    const port = req.body.port;
    const password = req.body.password;
    const username = req.body.username;
    const email = req.body.email || req.body.from_email;
    const to = req.body.to || req.body.to_email;

    if (!to) {
      return res.json({ success: false, msg: "Recipient email address ('to') is required" });
    }

    let finalHost = host;
    let finalPort = port;
    let finalEmail = email;
    let finalUsername = username;
    let finalPassword = password;

    // If credentials omitted or masked, pull from saved smtp configuration
    if (!finalHost || !finalPort || !finalEmail || !finalPassword || finalPassword === "••••••••••••") {
      const [saved] = await query(`SELECT * FROM smtp LIMIT 1`, []);
      if (!saved) {
        return res.json({ success: false, msg: "No saved SMTP settings found. Please fill all fields." });
      }
      finalHost = finalHost || saved.host;
      finalPort = finalPort || saved.port;
      finalEmail = finalEmail || saved.email;
      finalUsername = finalUsername || saved.username;
      finalPassword = (finalPassword && finalPassword !== "••••••••••••") ? finalPassword : saved.password;
    }

    const checkEmail = await sendEmail(
      finalHost,
      finalPort,
      finalEmail,
      finalPassword,
      `<h1>Resend SMTP Test Successful</h1><p>Your SMTP credentials are configured correctly and active.</p>`,
      "Resend SMTP Testing",
      req.body.from_name || "Resend System",
      to,
      finalUsername,
    );

    if (checkEmail.success) {
      res.json({ success: true, msg: `Test email sent successfully to ${to}` });
    } else {
      res.json({ success: false, msg: checkEmail?.err || "Failed to dispatch test email" });
    }
  } catch (err) {
    logger.log(err);
    res.json({ success: false, msg: err.message || "Failed to send test email" });
  }
});

// get dashboard for user
router.get("/get_dashboard_for_user", adminValidator, async (req, res) => {
  try {
    // Get users data (selective projection)
    const getUsers = await query(`SELECT id, uid, name, email, plan, createdAt FROM user`, []);
    const { paidSignupsByMonth, unpaidSignupsByMonth } =
      getUserSignupsByMonth(getUsers);

    // Get orders data (selective projection)
    // Real revenue only: paid orders, no free trials / admin grants
    const getOrders = await query(
      `SELECT id, uid, amount, status, payment_mode, data, createdAt FROM orders
       WHERE LOWER(status) IN ('paid', 'success') AND payment_mode NOT IN ('FREE_TRIAL', 'ADMIN_GRANT')`,
      [],
    );
    const orders = getUserOrderssByMonth(getOrders);

    // Get contact form count
    const [contactFormCount] = await query(`SELECT COUNT(*) AS count FROM contact_form`, []);

    // Get chats data (selective projection)
    const getChats = await query(`SELECT createdAt FROM beta_chats WHERE createdAt >= MAKEDATE(YEAR(NOW()), 1)`, []);
    const chatsByMonth = getChatsByMonth(getChats);

    // Get conversations data (selective projection)
    const getConversations = await query(`SELECT type, msgContext, createdAt FROM beta_conversation WHERE createdAt >= MAKEDATE(YEAR(NOW()), 1)`, []);
    const messagesByMonth = getMessagesByMonth(getConversations);

    // Get message types distribution
    const messageTypes = getMessageTypeDistribution(getConversations);

    // Get agents data
    const getAgents = await query(`SELECT id, name FROM agents`, []);

    // Get agent tasks data
    const getAgentTasks = await query(`SELECT id, agent_id, status FROM agent_task`, []);
    const agentPerformance = getAgentPerformance(getAgents, getAgentTasks);

    // Get instances data (WhatsApp connections)
    const getInstances = await query(`SELECT status FROM instance`, []);
    const activeInstances = getInstances.filter(
      (instance) => instance.status === "ACTIVE",
    ).length;

    // Get flows count
    const [flowsCount] = await query(`SELECT COUNT(*) AS count FROM beta_flows`, []);

    // Get system metrics (this would typically come from a monitoring service)
    // Real host readings (these used to be random numbers)
    const os = require("os");
    let diskSpace = 0;
    try {
      const st = require("fs").statfsSync("/");
      diskSpace = Math.round((1 - st.bavail / st.blocks) * 100);
    } catch (_) {}
    const systemMetrics = {
      serverLoad: Math.min(100, Math.round((os.loadavg()[0] / Math.max(1, os.cpus().length)) * 100)),
      memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      diskSpace,
      activeSessions: activeInstances,
    };

    // Get recent users (last 5)
    const recentUsers = getUsers
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        plan: JSON.parse(user.plan || "{}").title || "No Plan",
        date: new Date(user.createdAt).toISOString().split("T")[0],
      }));

    // Get recent transactions (last 5)
    const recentTransactions = getOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((order) => {
        const user = getUsers.find((u) => u.uid === order.uid);
        let od = {};
        try {
          od = JSON.parse(order.data || "{}");
        } catch (_) {}
        return {
          id: order.id,
          user: user ? user.name : "Unknown",
          amount: `${String(od.currency || "").toUpperCase() || ""} ${order.amount}`.trim(),
          plan: od.plan?.title || "Subscription",
          status: order.status || "paid",
          date: new Date(order.createdAt).toISOString().split("T")[0],
        };
      });

    res.json({
      data: {
        // User data
        paid: paidSignupsByMonth,
        unpaid: unpaidSignupsByMonth,
        userLength: getUsers.length,
        recentUsers,

        // Financial data
        orders,
        orderLength: getOrders.length,
        recentTransactions,

        // Contact and chat data
        contactLength: contactFormCount?.count || 0,
        chatLength: getChats.length,
        chatsByMonth,
        messagesByMonth,
        messageTypes,

        // Agent data
        agentLength: getAgents.length,
        agentPerformance,

        // System data
        activeInstances,
        flowsLength: flowsCount?.count || 0,
        systemMetrics,
      },
      success: true,
    });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// Helper function to get user signups by month
function getUserSignupsByMonth(users) {
  const paidSignupsByMonth = Array(12).fill(0);
  const unpaidSignupsByMonth = Array(12).fill(0);

  users.forEach((user) => {
    const createdAt = new Date(user.createdAt);
    if (createdAt.getFullYear() !== new Date().getFullYear()) return;
    const month = createdAt.getMonth();

    // Check if user has a paid plan
    const plan = JSON.parse(user.plan || "{}");
    const isPaid = plan && plan.title && Number(plan.is_trial) === 0;

    if (isPaid) {
      paidSignupsByMonth[month]++;
    } else {
      unpaidSignupsByMonth[month]++;
    }
  });

  return { paidSignupsByMonth, unpaidSignupsByMonth };
}

// Helper function to get orders by month
function getUserOrderssByMonth(orders) {
  const ordersByMonth = Array(12).fill(0);

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    if (createdAt.getFullYear() !== new Date().getFullYear()) return;
    const month = createdAt.getMonth();
    const amount = parseFloat(order.amount) || 0;

    ordersByMonth[month] += amount;
  });

  return ordersByMonth;
}

// Helper function to get chats by month
function getChatsByMonth(chats) {
  const chatsByMonth = Array(12).fill(0);

  chats.forEach((chat) => {
    const createdAt = new Date(chat.createdAt);
    const month = createdAt.getMonth();

    chatsByMonth[month]++;
  });

  return chatsByMonth;
}

// Helper function to get messages by month
function getMessagesByMonth(conversations) {
  const messagesByMonth = Array(12).fill(0);

  conversations.forEach((conversation) => {
    const createdAt = new Date(conversation.createdAt);
    const month = createdAt.getMonth();

    messagesByMonth[month]++;
  });

  return messagesByMonth;
}

// Helper function to get message type distribution
function getMessageTypeDistribution(conversations) {
  const types = {
    text: 0,
    image: 0,
    video: 0,
    document: 0,
    location: 0,
    contact: 0,
    other: 0,
  };

  conversations.forEach((conversation) => {
    try {
      const msgContext = JSON.parse(conversation.msgContext || "{}");
      const type = msgContext.type || "other";

      if (types[type] !== undefined) {
        types[type]++;
      } else {
        types.other++;
      }
    } catch (error) {
      types.other++;
    }
  });

  return [
    types.text,
    types.image,
    types.video,
    types.document,
    types.location,
    types.contact,
    types.other,
  ];
}

// Helper function to get agent performance
function getAgentPerformance(agents, tasks) {
  return agents.slice(0, 3).map((agent) => {
    const agentTasks = tasks.filter((task) => String(task.agent_id) === String(agent.id));
    const completedTasks = agentTasks.filter(
      (task) => task.status === "COMPLETED",
    ).length;
    const completionRate =
      agentTasks.length > 0 ? (completedTasks / agentTasks.length) * 100 : 0;

    // Only metrics we actually track; the rest are 0 instead of invented numbers
    return {
      name: agent.name,
      data: [0, Math.round(completionRate), 0, agentTasks.length, completedTasks],
    };
  });
}

// get admin
router.get("/get_admin", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM admin`, []);
    res.json({ data: data[0], success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

router.post("/update-admin", adminValidator, async (req, res) => {
  try {
    if (req.body.newpass) {
      const hash = await bcrypt.hash(req.body.newpass, 10);

      // ✅ Bump tokenVersion so all old tokens are instantly invalidated
      await query(
        `UPDATE admin SET email = ?, password = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE uid = ?`,
        [req.body.email, hash, req.decode.uid],
      );

      res.json({ success: true, msg: "Admin was updated refresh the page" });
    } else {
      await query(`UPDATE admin SET email = ? WHERE uid = ?`, [
        req.body.email,
        req.decode.uid,
      ]);
      res.json({ success: true, msg: "Admin was updated refresh the page" });
    }
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// send recover
router.post("/send_resovery", authRateLimiter({ limit: 5, prefix: "admin_recovery" }), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.json({ msg: "Please enter a valid email" });
    }

    const checkEmailValid = await query(`SELECT uid, email, tokenVersion FROM admin WHERE LOWER(email) = ?`, [
      email,
    ]);
    if (checkEmailValid.length < 1) {
      return res.json({
        success: true,
        msg: "We have sent a recovery link if this email is associated with admin account.",
      });
    }

    const getWeb = await query(`SELECT * FROM web_public`, []);
    const appName = getWeb[0]?.app_name;

    // Purpose-bound reset token: no admin role (so it can't be used as a session) and
    // tied to tokenVersion, which the reset bumps, so the link works only once.
    const jsontoken = sign(
      {
        purpose: "admin_password_reset",
        admin_uid: checkEmailValid[0].uid,
        tv: Number(checkEmailValid[0].tokenVersion || 0),
      },
      process.env.JWTKEY,
      { expiresIn: "1h" },
    );

    const recpveryUrl = `${process.env.FRONTENDURI}/recovery-admin/${jsontoken}`;

    const getHtml = recoverEmail(appName, recpveryUrl);

    // getting smtp
    const smtp = await query(`SELECT * FROM smtp`, []);
    if (
      !smtp[0]?.email ||
      !smtp[0]?.host ||
      !smtp[0]?.port ||
      !smtp[0]?.password ||
      !smtp[0]?.username
    ) {
      return res.json({
        success: false,
        msg: "SMTP connections not found! Unable to send recovery link",
      });
    }

    await sendEmail(
      smtp[0]?.host,
      smtp[0]?.port,
      smtp[0]?.email,
      smtp[0]?.password,
      getHtml,
      `${appName} - Password Recovery`,
      smtp[0]?.email,
      email,
      smtp[0]?.username,
    );

    res.json({
      success: true,
      msg: "We have sent a recovery link if this email is associated with admin account.",
    });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// Admin password reset from the emailed link (POST body; the password never goes in a URL)
router.post("/reset_password", authRateLimiter({ limit: 10, prefix: "admin_reset" }), async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof password !== "string" || password.length < 8) {
      return res.json({ success: false, msg: "Password must be at least 8 characters" });
    }

    let decoded;
    try {
      decoded = verifyJwt(String(token), process.env.JWTKEY);
    } catch (_) {
      return res.json({ success: false, msg: "This reset link is invalid or has expired" });
    }
    if (decoded?.purpose !== "admin_password_reset" || !decoded.admin_uid) {
      return res.json({ success: false, msg: "This reset link is invalid or has expired" });
    }

    const [admin] = await query(`SELECT uid, tokenVersion FROM admin WHERE uid = ?`, [decoded.admin_uid]);
    if (!admin || Number(admin.tokenVersion || 0) !== Number(decoded.tv || 0)) {
      return res.json({ success: false, msg: "This reset link has already been used or has expired" });
    }

    const hashpassword = await bcrypt.hash(password, 10);
    // Bumping tokenVersion logs out every admin session and burns this link
    await query(
      `UPDATE admin SET password = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE uid = ?`,
      [hashpassword, admin.uid],
    );
    await audit({ decode: { uid: admin.uid }, headers: req.headers, ip: req.ip }, "ADMIN_PASSWORD_RESET", "ADMIN", admin.uid);

    res.json({ success: true, msg: "Your password has been changed. You can log in now." });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// Helper: Transactional deletion of tenant user and all operational dependent records
async function safelyDeleteUserTenantData(connection, user) {
  const uid = user.uid;

  // 1. Invalidate all active user sessions immediately
  await connection.query(
    `UPDATE user SET tokenVersion = COALESCE(tokenVersion, 0) + 100 WHERE uid = ?`,
    [uid]
  );

  // 1b. Close live WhatsApp (QR) sessions so they stop running after the rows are gone
  try {
    const [qrRows] = await connection.query(`SELECT uniqueId FROM instance WHERE uid = ?`, [uid]);
    const qrHelper = getQrHelper();
    for (const row of qrRows || []) {
      const session = qrHelper.getSession ? qrHelper.getSession(row.uniqueId) : null;
      if (session) {
        try {
          await session.logout();
        } catch (_) {}
      }
      if (qrHelper.deleteSession) {
        try {
          qrHelper.deleteSession(row.uniqueId);
        } catch (_) {}
      }
    }
  } catch (err) {
    logger.error("[del_user] QR session cleanup failed:", err.message);
  }

  // Child rows keyed by a parent id, removed before their parents
  for (const sql of [
    `DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE uid = ?)`,
    `DELETE FROM api_key_connections WHERE api_key_id IN (SELECT id FROM api_keys WHERE uid = ?)`,
  ]) {
    try {
      await connection.query(sql, [uid]);
    } catch (_) {}
  }

  // 2. Cascade delete tenant operational data across related tables
  const tenantTables = [
    "chat_widget",
    "rooms",
    "instance",
    "meta_api",
    "email_verification",
    "wa_contacts",
    "contact",
    "phonebook",
    "templets",
    "meta_templet_media",
    "beta_campaign_logs",
    "beta_campaign",
    "qr_campaign_logs",
    "qr_campaigns",
    "broadcast_log",
    "broadcast",
    "beta_conversation",
    "beta_chats",
    "chats",
    "agent_chats",
    "agent_task",
    "chat_tags",
    "quick_reply",
    "flow_session",
    "beta_flows",
    "flow",
    "flow_data",
    "beta_chatbot",
    "chatbot",
    "wa_forms",
    "wa_form_submissions",
    "wa_call_bot",
    "wa_call_flows",
    "wa_call_logs",
    "wa_call_broadcasts",
    "warmers",
    "warmer_script",
    "messenger_accounts",
    "instagram_accounts",
    "telegram_session",
    "api_keys",
    "api_connections",
    "api_usage_events",
    "api_idempotency_keys",
    "beta_api_logs",
    "webhooks",
    "webhook_logs",
    "in_app_notifications",
    "fcm_tokens",
    "support_tickets",
  ];

  for (const table of tenantTables) {
    try {
      await connection.query(`DELETE FROM \`${table}\` WHERE uid = ?`, [uid]);
    } catch (_) {
      // Ignore if table does not exist in schema
    }
  }

  // Also remove team support agents belonging to this tenant
  try {
    await connection.query(`DELETE FROM agents WHERE owner_uid = ?`, [uid]);
  } catch (_) {}

  // Statutory retention note: Financial ledger records in `orders` are deliberately preserved for compliance and audit

  // 3. Delete tenant account record
  await connection.query(`DELETE FROM user WHERE uid = ?`, [uid]);
}

// del single user (transactional & safe)
router.post("/del_user", adminValidator, async (req, res) => {
  let connection;
  try {
    const { id, uid } = req.body;
    if (!id && !uid) {
      return res.status(400).json({ msg: "User ID or UID is required", success: false });
    }

    const [user] = await query(
      `SELECT id, uid, email, role FROM user WHERE id = ? OR uid = ?`,
      [id || null, uid || null]
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found", success: false });
    }

    const currentAdminUid = req.decode?.uid;
    const rootAdmins = await query(`SELECT uid, email FROM admin`, []);
    const protectedAdminUids = new Set(
      rootAdmins.map((a) => a.uid).concat(currentAdminUid ? [currentAdminUid] : [])
    );

    if (user.role === "admin" || protectedAdminUids.has(user.uid)) {
      return res.status(403).json({
        success: false,
        msg: "Administrator accounts cannot be deleted.",
      });
    }

    const pool = con.promise();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await safelyDeleteUserTenantData(connection, user);

    await connection.commit();

    logger.log(`[Admin Audit] Admin ${currentAdminUid} deleted user ${user.uid} (${user.email})`);
    await audit(req, "USER_DELETE", "USER", user.uid, { email: user.email });

    res.json({ success: true, msg: "User was deleted successfully." });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    logger.error("Admin del_user error:", err);
    res.status(500).json({ msg: "Something went wrong", success: false });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Bulk delete users (transactional, safe & audited)
router.post("/delete_users", adminValidator, async (req, res) => {
  let connection;
  try {
    const rawIds = req.body.userIds || req.body.ids || req.body.uids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "Please provide a non-empty array of user identifiers to delete.",
      });
    }

    if (rawIds.length > 100) {
      return res.status(400).json({
        success: false,
        msg: "Cannot delete more than 100 users at once.",
      });
    }

    const currentAdminUid = req.decode?.uid;

    // Fetch existing root admin identifiers to prevent deletion
    const rootAdmins = await query(`SELECT uid, email FROM admin`, []);
    const protectedAdminUids = new Set(
      rootAdmins.map((a) => a.uid).concat(currentAdminUid ? [currentAdminUid] : [])
    );
    const protectedAdminEmails = new Set(rootAdmins.map((a) => a.email?.toLowerCase()));

    for (const rawId of rawIds) {
      if (protectedAdminUids.has(String(rawId))) {
        return res.status(400).json({
          success: false,
          msg: "Protected system administrator accounts cannot be deleted.",
        });
      }
    }

    // Lookup users to delete
    const placeholders = rawIds.map(() => "?").join(",");
    const users = await query(
      `SELECT id, uid, email, role FROM user WHERE id IN (${placeholders}) OR uid IN (${placeholders})`,
      [...rawIds, ...rawIds]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "No matching users found to delete.",
      });
    }

    // Filter out protected accounts
    const validUsersToDelete = [];
    const protectedUsers = [];

    for (const u of users) {
      if (
        u.role === "admin" ||
        protectedAdminUids.has(u.uid) ||
        protectedAdminEmails.has(u.email?.toLowerCase())
      ) {
        protectedUsers.push(u.email || u.uid);
      } else {
        validUsersToDelete.push(u);
      }
    }

    if (validUsersToDelete.length === 0) {
      return res.status(403).json({
        success: false,
        msg: "Selected user accounts are protected system administrators and cannot be deleted.",
      });
    }

    // Begin atomic transaction
    const pool = con.promise();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const deletedIds = [];
    for (const user of validUsersToDelete) {
      await safelyDeleteUserTenantData(connection, user);
      deletedIds.push(user.id);
    }

    await connection.commit();

    logger.log(
      `[Admin Audit] Admin ${currentAdminUid} deleted ${validUsersToDelete.length} users:`,
      validUsersToDelete.map((u) => u.uid)
    );
    await audit(req, "USER_BULK_DELETE", "USER", validUsersToDelete.map((u) => u.uid).join(",").slice(0, 255), {
      count: validUsersToDelete.length,
      emails: validUsersToDelete.map((u) => u.email),
    });

    res.json({
      success: true,
      deletedCount: validUsersToDelete.length,
      deletedIds,
      msg: `Successfully deleted ${validUsersToDelete.length} user(s).${
        protectedUsers.length > 0 ? ` (${protectedUsers.length} protected accounts were skipped)` : ""
      }`,
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    logger.error("Admin delete_users error:", err);
    res.status(500).json({
      success: false,
      msg: "Failed to delete users. Database transaction rolled back.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Explicit action to manually verify a user's email
router.post("/verify_user_email", adminValidator, async (req, res) => {
  try {
    const { uid, id } = req.body;
    if (!uid && !id) {
      return res.status(400).json({ success: false, msg: "User UID or ID is required" });
    }

    const whereOr = [];
    if (uid) whereOr.push({ uid: String(uid) });
    if (id) whereOr.push({ id: parseInt(id, 10) });

    const user = await prisma.user.findFirst({
      where: {
        OR: whereOr,
      },
      select: {
        id: true,
        uid: true,
        email: true,
        email_verified_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { uid: user.uid },
        data: { email_verified_at: now },
      });
      await tx.email_verification.updateMany({
        where: {
          email: user.email,
          used_at: null,
        },
        data: { used_at: now },
      });
    });

    logger.log(`[Admin Audit] Admin ${req.decode?.uid} manually verified email for ${user.email} (${user.uid})`);

    res.json({
      success: true,
      msg: `Email for ${user.email} marked as verified.`,
    });
  } catch (err) {
    logger.error("verify_user_email error:", err);
    res.status(500).json({ success: false, msg: "Failed to verify user email" });
  }
});

// get all genn wa links
router.get("/get_wa_gen", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM gen_links`, []);
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// del gen link
router.post("/de_wa_den_link", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM gen_links WHERE id = ?`, [id]);
    res.json({ msg: "Generated link was deleted", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// get social login (secured with adminValidator, sensitive credentials stripped)
router.get("/get_social_login", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM web_public LIMIT 1`, []);
    const publicData = data[0] ? { ...data[0] } : {};
    // Do not return raw application secrets
    delete publicData.fb_login_app_sec;
    res.json({ data: publicData, success: true });
  } catch (err) {
    logger.error("get_social_login error:", err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// update social things
router.post("/update_social_login", adminValidator, async (req, res) => {
  try {
    const {
      google_client_id,
      google_login_active,
      fb_login_app_id,
      fb_login_app_sec,
      fb_login_active,
    } = req.body;

    await query(
      `UPDATE web_public SET google_client_id = ?, google_login_active = ?, fb_login_app_id = ?, fb_login_app_sec = ?, fb_login_active = ? WHERE id = 1 OR id > 0 LIMIT 1`,
      [
        google_client_id || "",
        google_login_active ? 1 : 0,
        fb_login_app_id || "",
        fb_login_app_sec || "",
        fb_login_active || "",
      ],
    );

    res.json({ msg: "Settings updated", success: true });
  } catch (err) {
    logger.error("update_social_login error:", err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// get dedicated Google authentication settings
router.get("/get_google_auth_settings", adminValidator, async (req, res) => {
  try {
    const { clientId, clientSecret, isActive, isConfigured } = await getGoogleAuthConfig();
    res.json({
      success: true,
      data: {
        google_client_id: clientId || "",
        google_login_active: Boolean(isActive),
        has_client_secret: Boolean(clientSecret && clientSecret.length > 0),
        is_configured: isConfigured,
      },
    });
  } catch (err) {
    logger.error("get_google_auth_settings error:", err);
    res.status(500).json({ success: false, msg: "Failed to get Google authentication settings" });
  }
});

// update dedicated Google authentication settings
router.post("/update_google_auth_settings", adminValidator, async (req, res) => {
  try {
    const { google_client_id, google_client_secret, google_login_active } = req.body;

    const isActive = google_login_active === true || google_login_active === 1 || google_login_active === "1" ? 1 : 0;
    const cleanClientId = typeof google_client_id === "string" ? google_client_id.trim() : "";

    // 1. Update public configuration in web_public
    await query(
      `UPDATE web_public SET google_client_id = ?, google_login_active = ? WHERE id = 1 OR id > 0 LIMIT 1`,
      [cleanClientId, isActive]
    );

    // 2. Update private secret in web_private ONLY if explicitly provided (never wipe when empty)
    const hasNewSecret = typeof google_client_secret === "string" && google_client_secret.trim() !== "";
    if (hasNewSecret) {
      await query(
        `UPDATE web_private SET google_client_secret = ? WHERE id = 1 OR id > 0 LIMIT 1`,
        [google_client_secret.trim()]
      );
    }

    // 3. Admin audit log
    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.decode?.uid || "admin",
        "SETTINGS_UPDATE",
        "GOOGLE_AUTH",
        "oauth_credentials",
        JSON.stringify({
          google_client_id: cleanClientId,
          google_login_active: isActive,
          secret_updated: hasNewSecret,
        }),
      ]
    );

    res.json({ success: true, msg: "Google authentication settings updated successfully" });
  } catch (err) {
    logger.error("update_google_auth_settings error:", err);
    res.status(500).json({ success: false, msg: "Failed to update Google authentication settings" });
  }
});

// update rtl
router.post("/update_rtl", adminValidator, async (req, res) => {
  try {
    const { rtl } = req.body;

    await query(`UPDATE web_public SET rtl = ?`, [rtl ? 1 : 0]);

    res.json({ success: true, msg: "RTL was updated" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// update qr plugin setting
router.get("/get_qr_set", adminValidator, async (req, res) => {
  try {
    const [web] = await query(`SELECT * FROM web_private`, []);
    if (!web) return res.json({ msg: "Web private not found" });

    res.json({ success: true, data: web });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// update qr set
router.post("/update_qr_set", adminValidator, async (req, res) => {
  try {
    const { type, mongodbString } = req.body;
    if (!["local", "mysql", "mongodb"]?.includes(type)) {
      return res.json({ msg: "Invalid type found" });
    }

    if (type === "mongodb") {
      if (!mongodbString) {
        return res.json({ msg: "MongoDB String not found" });
      }

      const testMongo = await testMongoConnection(mongodbString);
      if (!testMongo.success) {
        return res.json({ msg: testMongo.msg });
      }
    }

    await query(`UPDATE web_private SET qr_storage = ?, mongodb_string = ?`, [
      type,
      mongodbString,
    ]);

    res.json({ msg: "QR settings updated", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// get mobile app.
router.get("/get_mobile_app_dt", adminValidator, async (req, res) => {
  try {
    const [data] = await query(`SELECT * FROM mobile_app`, []);
    res.json({ data, success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// requires mb
router.post("/update_mb", adminValidator, async (req, res) => {
  try {
    const { fcmJson, appTheme } = req.body;
    const [data] = await query(`SELECT * FROM mobile_app`, []);
    if (data) {
      await query(`UPDATE mobile_app SET fcmJson = ?, appTheme = ?`, [
        fcmJson,
        appTheme,
      ]);
    } else {
      await query(`INSERT INTO mobile_app (fcmJson, appTheme) VALUES (?,?)`, [
        fcmJson,
        appTheme,
      ]);
    }

    res.json({ msg: "Updated", success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// get embed config for admin (never exposes raw app secret)
router.get("/get_embed_config", adminValidator, async (req, res) => {
  try {
    const [web] = await query(
      `SELECT embed_app_id, embed_app_config, embed_app_sec FROM web_private LIMIT 1`,
      [],
    );
    res.json({
      success: true,
      data: {
        appId: web?.embed_app_id || "",
        configId: web?.embed_app_config || "",
        graphVersion: "v21.0",
        hasAppSecret: Boolean(web?.embed_app_sec && web.embed_app_sec.trim().length > 0),
      },
    });
  } catch (err) {
    logger.error("get_embed_config error:", err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// update web pvt embed config
router.post("/update_embed_config", adminValidator, async (req, res) => {
  try {
    const appId = req.body.appId ?? req.body.embed_app_id ?? "";
    const configId = req.body.configId ?? req.body.embed_app_config ?? "";
    const appSec = req.body.appSecret ?? req.body.embed_app_sec;

    if (appSec !== undefined && appSec !== null && appSec.trim().length > 0) {
      await query(
        `UPDATE web_private SET embed_app_sec = ?, embed_app_id = ?, embed_app_config = ?`,
        [appSec.trim(), appId.trim(), configId.trim()],
      );
    } else {
      // Preserve existing secret when blank
      await query(
        `UPDATE web_private SET embed_app_id = ?, embed_app_config = ?`,
        [appId.trim(), configId.trim()],
      );
    }

    res.json({ msg: "Meta configuration saved successfully", success: true });
  } catch (err) {
    logger.error("update_embed_config error:", err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// get telegram confi
router.get("/get_tele_config", adminValidator, async (req, res) => {
  try {
    const [data] = await query(
      `SELECT teleAppId, teleHash FROM web_private`,
      [],
    );
    res.json({ data, success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// update teleg config
router.post("/update_tele_config", adminValidator, async (req, res) => {
  try {
    const { teleAppId, teleHash } = req.body;
    await query(`UPDATE web_private SET teleAppId = ?, teleHash = ?`, [
      teleAppId,
      teleHash,
    ]);

    res.json({ msg: "Updated", success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

const validateLastNode = (nodes, edges) => {
  // Find all target nodes (nodes that have incoming connections)
  const targetNodeIds = new Set(edges.map((edge) => edge.target));

  // Find source nodes that aren't targets (potential starting nodes)
  const startingNodes = nodes.filter((node) => !targetNodeIds.has(node.id));

  // If no edges exist, just check the last node in array
  if (edges.length === 0) {
    const lastNode = nodes[nodes.length - 1];
    if (lastNode?.data?.moveToNextNode) {
      return {
        isValid: false,
        message: `${lastNode?.type} Node cannot be last.`,
      };
    }
    return { isValid: true };
  }

  // Traverse the flow to find the actual last connected node
  let lastConnectedNode = null;
  const visited = new Set();

  const traverse = (currentNodeId) => {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);
    if (outgoingEdges.length === 0) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (
        node &&
        (!lastConnectedNode || node.position.x > lastConnectedNode.position.x)
      ) {
        lastConnectedNode = node;
      }
      return;
    }

    outgoingEdges.forEach((edge) => {
      traverse(edge.target);
    });
  };

  // Start traversal from all starting nodes
  startingNodes.forEach((node) => traverse(node.id));

  if (lastConnectedNode?.data?.moveToNextNode) {
    return {
      isValid: false,
      message: `${lastConnectedNode?.type} Node cannot be last in the flow.`,
    };
  }

  return { isValid: true };
};

// add flow template
router.post("/add_flow_template", adminValidator, async (req, res) => {
  try {
    const { data, title, description, source } = req.body;

    if (!title || !data || !description) {
      return res.json({ msg: "Please fill all the fields", success: false });
    }

    const nodesVar = data?.nodes || [];

    const validation = validateLastNode(nodesVar, data?.edges);
    if (!validation.isValid) {
      return res.json({ msg: validation.message, success: false });
    }

    const sourceTypes = [
      "wa_chatbot",
      "webhook_flow",
      "webhook_automation",
      "telegram_chatbot",
    ];

    if (!sourceTypes.includes(source)) {
      return res.json({
        msg: `Unknown flow source found: ${source}`,
        success: false,
      });
    }

    if (data?.nodes?.length < 1 || data?.edges?.length < 1) {
      return res.json({ msg: "Blank flow can ot be saved", success: false });
    }

    await query(
      `INSERT INTO flow_templates (title, description, source, data) VALUES (?,?,?,?)`,
      [title, description, source, JSON.stringify(data)],
    );

    res.json({ msg: "Flow template added successfully", success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// get admin flow temp
router.get("/get_flow_templates", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM flow_templates`, []);
    res.json({ data, success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// delete flow template
router.post("/delete_flow_template", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.json({ msg: "Flow template ID is required", success: false });
    }

    await query(`DELETE FROM flow_templates WHERE id = ?`, [id]);

    res.json({ msg: "Flow template deleted successfully", success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// get fcm data admin
router.get("/get_fcm_data", adminValidator, async (req, res) => {
  try {
    const [data] = await query(
      `SELECT fcm_apiKey, 
      fcm_authDomain, 
      fcm_projectId, 
      fcm_storageBucket, 
      fcm_messagingSenderId, 
      fcm_appId, 
      fcm_measurementId, 
      fcm_vapidKey, 
      fcm_clientEmail, 
      fcm_privateKey FROM web_private`,
      [],
    );
    res.json({ data, success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

router.post("/update_fcm_data", adminValidator, async (req, res) => {
  try {
    const {
      fcm_apiKey,
      fcm_authDomain,
      fcm_projectId,
      fcm_storageBucket,
      fcm_messagingSenderId,
      fcm_appId,
      fcm_measurementId,
      fcm_vapidKey,
      fcm_clientEmail,
      fcm_privateKey,
    } = req.body;

    await query(
      `UPDATE web_private SET
        fcm_apiKey = ?,
        fcm_authDomain = ?,
        fcm_projectId = ?,
        fcm_storageBucket = ?,
        fcm_messagingSenderId = ?,
        fcm_appId = ?,
        fcm_measurementId = ?,
        fcm_vapidKey = ?,
        fcm_clientEmail = ?,
        fcm_privateKey = ?`,
      [
        fcm_apiKey,
        fcm_authDomain,
        fcm_projectId,
        fcm_storageBucket,
        fcm_messagingSenderId,
        fcm_appId,
        fcm_measurementId,
        fcm_vapidKey,
        fcm_clientEmail,
        fcm_privateKey,
      ],
    );

    res.json({ success: true });
  } catch (err) {
    logger.error(err);
    res.json({ msg: "Something went wrong", success: false });
  }
});

// get fcm token users
router.get("/get_fcm_subs", adminValidator, async (req, res) => {
  try {
    const data = await query(
      `
       SELECT 
        f.id,
        f.uid,
        f.token,
        u.name AS userName,
        u.email AS userEmail,
        a.name AS agentName,
        a.email AS agentEmail
      FROM fcm_tokens f
      LEFT JOIN user u ON u.uid = f.uid
      LEFT JOIN agents a ON a.uid = f.uid
      `,
      [],
    );

    const result = data.map((t) => {
      // SAFETY CHECK (important)
      if (t.userEmail && t.agentEmail) {
        throw new Error(`UID ${t.uid} exists in BOTH users and agents`);
      }

      const isUser = !!t.userEmail;

      return {
        id: t.id,
        uid: t.uid,
        token: t.token,
        userEmail: isUser ? t.userEmail : t.agentEmail,
        userName: isUser ? t.userName : t.agentName,
        userType: isUser ? "user" : "agent",
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error(err);
    res.json({
      success: false,
      msg: err.message || "Something went wrong",
    });
  }
});

// send web push manually
router.post("/send_fcm_manul", adminValidator, async (req, res) => {
  try {
    // ── Validate FCM credentials ─────────────────────────────────────────────
    const [fcmData] = await query(
      `SELECT fcm_projectId, fcm_clientEmail, fcm_privateKey FROM web_private`,
      [],
    );

    if (!fcmData) {
      return res.json({
        success: false,
        msg: "FCM configuration not found in database.",
      });
    }

    const { fcm_projectId, fcm_clientEmail, fcm_privateKey } = fcmData;

    if (!fcm_projectId) {
      return res.json({
        success: false,
        msg: "FCM Project ID is missing. Please configure it in settings.",
      });
    }

    if (!fcm_clientEmail) {
      return res.json({
        success: false,
        msg: "FCM Client Email is missing. Please configure it in settings.",
      });
    }

    if (!fcm_privateKey) {
      return res.json({
        success: false,
        msg: "FCM Private Key is missing. Please configure it in settings.",
      });
    }

    // ── Validate request payload ─────────────────────────────────────────────
    const { tokens, notification, audienceType, totalRecipients } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.json({
        success: false,
        msg: "No recipient tokens provided. Make sure selected audience has active subscriptions.",
      });
    }

    if (!notification?.title) {
      return res.json({
        success: false,
        msg: "Notification title is required.",
      });
    }

    if (!notification?.body) {
      return res.json({
        success: false,
        msg: "Notification body is required.",
      });
    }

    const fcmResult = await sendFcmPushNotification({
      fcm_projectId,
      fcm_clientEmail,
      fcm_privateKey,
      tokens,
      notification,
    });

    if (!fcmResult.success) {
      return res.json({
        success: false,
        msg: fcmResult.msg,
      });
    }

    return res.json({
      success: true,
      msg: `Push sent — ${fcmResult.successCount} delivered, ${fcmResult.failureCount} failed.`,
      data: {
        successCount: fcmResult.successCount,
        failureCount: fcmResult.failureCount,
        totalSent: fcmResult.totalSent,
        audienceType,
        totalRecipients,
        results: fcmResult.results,
      },
    });
  } catch (err) {
    logger.error("FCM Send Error:", err);
    return res.json({
      success: false,
      msg:
        err.message || "Something went wrong while sending push notifications.",
    });
  }
});

// ── GET ──────────────────────────────────────────────────────────
router.get("/get_inbox_db", adminValidator, async (req, res) => {
  try {
    const [data] = await query(
      "SELECT inbox_db, inbox_db_data FROM web_private",
    );

    let source = "INBUILT";
    if (data?.inbox_db_data) {
      try {
        const parsed = JSON.parse(data.inbox_db_data);
        source = parsed?._source || "INBUILT";
      } catch (_) {}
    }

    res.json({ success: true, data: { ...data, source } });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: err.message || "Something went wrong." });
  }
});

// ── UPDATE ───────────────────────────────────────────────────────
router.post("/update_inbox_db", adminValidator, async (req, res) => {
  try {
    const typesDb = ["MYSQL", "MONGODB", "FIREBASE"];
    const { type, source, creds } = req.body;

    if (!typesDb.includes(type)) {
      return res.json({ success: false, msg: "Invalid db type found." });
    }

    let dbData = {};
    try {
      dbData = creds ? JSON.parse(creds) : {};
    } catch (_) {}

    dbData._source = source || "INBUILT";

    await query(`UPDATE web_private SET inbox_db = ?, inbox_db_data = ?`, [
      type,
      JSON.stringify(dbData),
    ]);

    res.json({ success: true, msg: "Inbox DB settings updated." });
  } catch (err) {
    logger.error(err);
    res.json({ success: false, msg: err.message || "Something went wrong." });
  }
});

// ── TEST CONNECTION ───────────────────────────────────────────────
router.post("/test_inbox_db", adminValidator, async (req, res) => {
  const { type, creds } = req.body;

  try {
    // ── MySQL ──────────────────────────────────────────────────
    if (type === "MYSQL") {
      const { host, port, user, password, database } = creds;

      if (!host || !user || !database) {
        return res.json({
          success: false,
          msg: "Host, user, and database are required.",
        });
      }

      const connection = await mysql.createConnection({
        host,
        port: parseInt(port) || 3306,
        user,
        password: password || "",
        database,
        connectTimeout: 8000,
      });

      await connection.query("SELECT 1");
      await connection.end();

      return res.json({ success: true, msg: "MySQL connection successful!" });
    }

    // ── MongoDB ────────────────────────────────────────────────
    if (type === "MONGODB") {
      const { uri } = creds;

      if (!uri) {
        return res.json({ success: false, msg: "MongoDB URI is required." });
      }

      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });

      await client.connect();
      await client.db().command({ ping: 1 });
      await client.close();

      return res.json({ success: true, msg: "MongoDB connection successful!" });
    }

    // ── Firebase Realtime DB ───────────────────────────────────
    if (type === "FIREBASE") {
      const { databaseUrl, serviceAccountJson } = creds;

      if (!databaseUrl || !serviceAccountJson) {
        return res.json({
          success: false,
          msg: "Database URL and Service Account JSON are required.",
        });
      }

      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch (_) {
        return res.json({
          success: false,
          msg: "Service Account JSON is not valid JSON.",
        });
      }

      // Use a unique app name so it doesn't clash with any existing firebase app
      const appName = `inbox_test_${Date.now()}`;
      const app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          databaseURL: databaseUrl,
        },
        appName,
      );

      // Ping by reading the root with a shallow query
      const db = admin.database(app);
      const ref = db.ref("/");
      await ref.limitToFirst(1).once("value");

      await app.delete(); // clean up test app instance

      return res.json({
        success: true,
        msg: "Firebase Realtime DB connection successful!",
      });
    }

    return res.json({ success: false, msg: "Invalid db type." });
  } catch (err) {
    logger.error(err);
    return res.json({
      success: false,
      msg: `Connection failed: ${err.message}`,
    });
  }
});

// ─── ADMIN PLATFORM ANALYTICS (REAL DATABASE METRICS ONLY) ───────────────────
const { getAdminPlatformAnalytics } = require("../services/analytics/analyticsService.js");

router.get("/analytics", adminValidator, async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;

    const data = await getAdminPlatformAnalytics({
      range,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error("Admin analytics error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      msg: err.message || "Failed to generate admin analytics",
    });
  }
});

// ─── ADMIN UPDATE PUBLIC SITE SETTINGS ───────────────────────────────────────
router.post("/update_web_public", adminValidator, async (req, res) => {
  try {
    const { app_name, meta_description, logo, login_header_footer } = req.body;

    const [existing] = await query(`SELECT * FROM web_public LIMIT 1`);
    if (existing) {
      await query(
        `UPDATE web_public 
         SET app_name = COALESCE(?, app_name),
             meta_description = COALESCE(?, meta_description),
             logo = COALESCE(?, logo),
             login_header_footer = COALESCE(?, login_header_footer)
         WHERE id = ?`,
        [app_name, meta_description, logo, login_header_footer, existing.id]
      );
    } else {
      await query(
        `INSERT INTO web_public (app_name, meta_description, logo, login_header_footer) 
         VALUES (?,?,?,?)`,
        [app_name, meta_description, logo, login_header_footer ? 1 : 0]
      );
    }

    // Audit log
    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
      [req.decode?.uid || "admin", "SETTINGS_UPDATE", "SITE_SETTINGS", "web_public", JSON.stringify({ app_name, meta_description })]
    );

    res.json({ success: true, msg: "Site settings updated successfully" });
  } catch (err) {
    logger.error("update_web_public error:", err);
    res.status(500).json({ success: false, msg: "Failed to update site settings", error: err.message });
  }
});

// ─── ADMIN MULTI-USER NOTIFICATION BROADCAST ────────────────────────────────
router.post("/send_notification", adminValidator, async (req, res) => {
  try {
    const {
      title,
      message,
      channels,
      audience_type,
      target_uids,
      target_plan_id,
      action_url,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, msg: "Title and message are required" });
    }

    const channelList = Array.isArray(channels) && channels.length > 0 ? channels : ["in_app"];

    // 1. Resolve recipients
    let recipientUsers = [];
    if (audience_type === "single") {
      const targetUid = Array.isArray(target_uids) ? target_uids[0] : target_uids;
      recipientUsers = await query(`SELECT uid, email, name FROM user WHERE uid = ?`, [targetUid]);
    } else if (audience_type === "multiple" && Array.isArray(target_uids) && target_uids.length > 0) {
      const placeholders = target_uids.map(() => "?").join(",");
      recipientUsers = await query(`SELECT uid, email, name FROM user WHERE uid IN (${placeholders})`, target_uids);
    } else if (audience_type === "plan" && target_plan_id) {
      recipientUsers = await query(
        `SELECT uid, email, name FROM user WHERE JSON_EXTRACT(plan, '$.id') = ? AND (is_blocked = 0 OR is_blocked IS NULL)`,
        [target_plan_id]
      );
    } else if (audience_type === "all") {
      recipientUsers = await query(
        `SELECT uid, email, name FROM user WHERE is_blocked = 0 OR is_blocked IS NULL`
      );
    } else {
      return res.status(400).json({ success: false, msg: "Invalid recipient audience specified" });
    }

    if (recipientUsers.length === 0) {
      return res.status(400).json({ success: false, msg: "No eligible recipients found for this audience" });
    }

    let sentCount = 0;
    let failedCount = 0;
    const recipientUids = recipientUsers.map((u) => u.uid);

    // 2. Dispatch In-App Notifications
    if (channelList.includes("in_app")) {
      try {
        const values = recipientUsers.map((u) => [
          u.uid,
          title,
          message,
          "INFO",
          action_url || null,
          0,
        ]);
        const placeholders = values.map(() => "(?,?,?,?,?,?)").join(",");
        const flatValues = values.flat();

        await query(
          `INSERT INTO in_app_notifications (uid, title, message, type, action_url, is_read) VALUES ${placeholders}`,
          flatValues
        );
        sentCount += recipientUsers.length;
      } catch (err) {
        logger.error("In-app notification dispatch error:", err);
        failedCount += recipientUsers.length;
      }
    }

    // 3. Dispatch Email Notifications via configured SMTP
    if (channelList.includes("email")) {
      try {
        const [smtp] = await query(`SELECT * FROM smtp LIMIT 1`);
        if (smtp && smtp.host && smtp.email && smtp.password) {
          const appName = "Resend";
          for (const u of recipientUsers) {
            if (u.email) {
              const htmlBody = `
                <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
                  <h2 style="color:#0f172a;margin-top:0;">${title}</h2>
                  <p style="color:#334155;font-size:15px;line-height:1.6;">${message.replace(/\n/g, "<br/>")}</p>
                  ${
                    action_url
                      ? `<div style="margin:24px 0;"><a href="${action_url}" style="background:#2563eb;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">View in Dashboard</a></div>`
                      : ""
                  }
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
                  <p style="color:#94a3b8;font-size:12px;">You received this notification from ${appName}.</p>
                </div>
              `;
              const resMail = await sendEmail(
                smtp.host,
                smtp.port,
                smtp.email,
                smtp.password,
                htmlBody,
                title,
                appName,
                u.email,
                smtp.username || smtp.email
              );
              if (resMail.success) sentCount++;
              else failedCount++;
            }
          }
        } else {
          logger.warn("SMTP not configured for email broadcast");
        }
      } catch (err) {
        logger.error("Email broadcast error:", err);
      }
    }

    // 4. Dispatch Push Notifications via FCM
    if (channelList.includes("push")) {
      try {
        const [fcmData] = await query(
          `SELECT fcm_projectId, fcm_clientEmail, fcm_privateKey FROM web_private LIMIT 1`
        );
        if (fcmData && fcmData.fcm_projectId && fcmData.fcm_clientEmail && fcmData.fcm_privateKey) {
          const placeholders = recipientUids.map(() => "?").join(",");
          const fcmTokens = await query(
            `SELECT token FROM fcm_tokens WHERE uid IN (${placeholders})`,
            recipientUids
          );
          const tokens = fcmTokens.map((t) => t.token).filter(Boolean);
          if (tokens.length > 0) {
            await sendFcmPushNotification({
              fcm_projectId: fcmData.fcm_projectId,
              fcm_clientEmail: fcmData.fcm_clientEmail,
              fcm_privateKey: fcmData.fcm_privateKey,
              tokens,
              notification: { title, body: message, clickUrl: action_url },
            });
          }
        }
      } catch (err) {
        logger.error("Push broadcast error:", err);
      }
    }

    // 5. Record Broadcast History & Admin Audit Log
    await query(
      `INSERT INTO notification_broadcast_history 
       (admin_uid, title, message, channels, audience_type, recipient_count, sent_count, failed_count, status, details)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.decode?.uid || "admin",
        title,
        message,
        channelList.join(","),
        audience_type,
        recipientUsers.length,
        sentCount,
        failedCount,
        failedCount === 0 ? "SENT" : (sentCount > 0 ? "PARTIAL" : "FAILED"),
        JSON.stringify({ channels: channelList, audience_type, recipientCount: recipientUsers.length }),
      ]
    );

    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
      [
        req.decode?.uid || "admin",
        "NOTIFICATION_BROADCAST",
        "NOTIFICATION",
        audience_type,
        JSON.stringify({ title, audience_type, recipients: recipientUsers.length, channels: channelList }),
      ]
    );

    res.json({
      success: true,
      msg: `Broadcast completed. Sent: ${sentCount}, Failed: ${failedCount}`,
      data: {
        recipientsTotal: recipientUsers.length,
        sentCount,
        failedCount,
      },
    });
  } catch (err) {
    logger.error("send_notification error:", err);
    res.status(500).json({ success: false, msg: "Failed to send broadcast", error: err.message });
  }
});

// ─── ADMIN NOTIFICATION BROADCAST HISTORY ───────────────────────────────────
router.get("/notification_history", adminValidator, async (req, res) => {
  try {
    const data = await query(
      `SELECT * FROM notification_broadcast_history ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error("notification_history error:", err);
    res.status(500).json({ success: false, msg: "Failed to load notification history", error: err.message });
  }
});

// ─── ADMIN MAIL TEMPLATES CRUD ──────────────────────────────────────────────
router.get("/mail_templates", adminValidator, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM mail_templates ORDER BY id ASC`);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error("get mail_templates error:", err);
    res.status(500).json({ success: false, msg: "Failed to load mail templates", error: err.message });
  }
});

router.post("/save_mail_template", adminValidator, async (req, res) => {
  try {
    const { id, name, subject, body, variables, is_active } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ success: false, msg: "Template name, subject, and body are required" });
    }

    if (id) {
      await query(
        `UPDATE mail_templates 
         SET name = ?, subject = ?, body = ?, variables = ?, is_active = ? 
         WHERE id = ?`,
        [name, subject, body, variables || "{{name}}, {{email}}", is_active ? 1 : 0, id]
      );
      res.json({ success: true, msg: "Template updated successfully" });
    } else {
      await query(
        `INSERT INTO mail_templates (name, subject, body, variables, is_active) 
         VALUES (?,?,?,?,?)`,
        [name, subject, body, variables || "{{name}}, {{email}}", is_active ? 1 : 0]
      );
      res.json({ success: true, msg: "Template created successfully" });
    }
  } catch (err) {
    logger.error("save_mail_template error:", err);
    res.status(500).json({ success: false, msg: "Failed to save template", error: err.message });
  }
});

router.post("/del_mail_template", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, msg: "Template ID is required" });
    }

    await query(`DELETE FROM mail_templates WHERE id = ?`, [id]);
    res.json({ success: true, msg: "Template deleted successfully" });
  } catch (err) {
    logger.error("del_mail_template error:", err);
    res.status(500).json({ success: false, msg: "Failed to delete template", error: err.message });
  }
});

router.post("/preview_mail_template", adminValidator, async (req, res) => {
  try {
    const { subject, body } = req.body;

    const sampleVars = {
      name: "Dev Shakya",
      email: "user@example.com",
      plan: "Business Pro Tier",
      amount: "₹1,999",
      app_name: "Resend",
      reset_link: "https://resend.in/recovery-user/sample-token-123",
    };

    let renderedSubject = subject || "";
    let renderedBody = body || "";

    for (const [key, val] of Object.entries(sampleVars)) {
      const reg = new RegExp(`{{${key}}}`, "g");
      renderedSubject = renderedSubject.replace(reg, val);
      renderedBody = renderedBody.replace(reg, val);
    }

    res.json({
      success: true,
      data: {
        renderedSubject,
        renderedBody,
      },
    });
  } catch (err) {
    logger.error("preview_mail_template error:", err);
    res.status(500).json({ success: false, msg: "Failed to preview template", error: err.message });
  }
});

// ─── ADMIN AUDIT LOGS ────────────────────────────────────────────────────────
router.get("/get_audit_logs", adminValidator, async (req, res) => {
  try {
    const data = await query(
      `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: data || [] });
  } catch (err) {
    logger.error("get_audit_logs error:", err);
    res.status(500).json({ success: false, msg: "Failed to load audit logs", error: err.message });
  }
});

// ─── GOD-MODE WORKSPACES MANAGEMENT ─────────────────────────────────────────
router.get("/get_workspaces", adminValidator, async (req, res) => {
  try {
    const { search = "", limit = 50, offset = 0 } = req.query;
    const cleanLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const cleanOffset = Math.max(parseInt(offset, 10) || 0, 0);

    let whereSql = "";
    let params = [];

    if (search && search.trim().length > 0) {
      whereSql = `WHERE u.name LIKE ? OR u.email LIKE ? OR u.uid LIKE ?`;
      const term = `%${search.trim()}%`;
      params = [term, term, term];
    }

    const countRows = await query(
      `SELECT COUNT(*) as total FROM user u ${whereSql}`,
      params
    );
    const totalCount = countRows[0]?.total || 0;

    const workspaces = await query(
      `SELECT 
        u.id, u.uid, u.name, u.email, u.mobile_with_country_code, u.timezone,
        u.plan, u.plan_expire, u.trial, u.is_blocked, u.createdAt,
        (SELECT COUNT(*) FROM agents a WHERE a.owner_uid = u.uid) as memberCount,
        (SELECT COUNT(*) FROM instance i WHERE i.uid = u.uid) as qrInstanceCount,
        (SELECT COUNT(*) FROM meta_api m WHERE m.uid = u.uid) as metaInstanceCount,
        (SELECT COUNT(*) FROM contact c WHERE c.uid = u.uid) as contactCount,
        (SELECT COUNT(*) FROM beta_campaign bc WHERE bc.uid = u.uid) as campaignCount
      FROM user u
      ${whereSql}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?`,
      [...params, cleanLimit, cleanOffset]
    );

    const formatted = workspaces.map((w) => {
      let parsedPlan = null;
      try {
        parsedPlan = w.plan ? (typeof w.plan === "string" ? JSON.parse(w.plan) : w.plan) : null;
      } catch (_) {}

      return {
        id: w.id,
        uid: w.uid,
        name: w.name || "Untitled Workspace",
        email: w.email,
        mobile: w.mobile_with_country_code,
        timezone: w.timezone || "UTC",
        is_blocked: Boolean(w.is_blocked),
        createdAt: w.createdAt,
        planTitle: parsedPlan?.title || "Free Tier",
        planExpire: w.plan_expire,
        parsedPlan,
        stats: {
          members: Number(w.memberCount || 0),
          qrInstances: Number(w.qrInstanceCount || 0),
          metaInstances: Number(w.metaInstanceCount || 0),
          totalInstances: Number(w.qrInstanceCount || 0) + Number(w.metaInstanceCount || 0),
          contacts: Number(w.contactCount || 0),
          campaigns: Number(w.campaignCount || 0),
        },
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        total: totalCount,
        limit: cleanLimit,
        offset: cleanOffset,
        hasMore: cleanOffset + cleanLimit < totalCount,
      },
    });
  } catch (err) {
    logger.error("get_workspaces error:", err);
    res.status(500).json({ success: false, msg: "Failed to retrieve workspaces", error: err.message });
  }
});

// ─── GOD-MODE ALL WHATSAPP INSTANCES (QR + META FLEET) ──────────────────────
router.get("/get_all_instances", adminValidator, async (req, res) => {
  try {
    const { status, type } = req.query;

    const [qrRows, metaRows] = await Promise.all([
      query(
        `SELECT i.id, i.uid, i.title, i.number, i.uniqueId, i.status, i.createdAt,
                u.name as owner_name, u.email as owner_email, u.is_blocked as owner_blocked
         FROM instance i
         LEFT JOIN user u ON i.uid = u.uid
         ORDER BY i.id DESC`
      ),
      query(
        `SELECT m.id, m.uid, m.waba_id, m.business_account_id, m.business_phone_number_id,
                m.platform_type, m.login_type, m.is_coexistence, m.createdAt,
                u.name as owner_name, u.email as owner_email, u.is_blocked as owner_blocked
         FROM meta_api m
         LEFT JOIN user u ON m.uid = u.uid
         ORDER BY m.id DESC`
      ),
    ]);

    // Live sync Baileys sessions for QR accounts
    const formattedQr = qrRows.map((q) => {
      const qrHelper = getQrHelper();
      const liveSession = qrHelper.getSession ? qrHelper.getSession(q.uniqueId) : null;
      const isOnline = Boolean(liveSession);
      const effectiveStatus = isOnline ? "ACTIVE" : (q.status === "ACTIVE" ? "DISCONNECTED" : (q.status || "INACTIVE"));

      return {
        id: q.id,
        uid: q.uid,
        uniqueId: q.uniqueId,
        title: q.title || "WhatsApp Web",
        number: q.number || "Not Paired",
        type: "QR",
        status: effectiveStatus,
        isLiveSession: isOnline,
        createdAt: q.createdAt,
        owner: {
          name: q.owner_name || "Unknown",
          email: q.owner_email || "N/A",
          isBlocked: Boolean(q.owner_blocked),
        },
      };
    });

    const formattedMeta = metaRows.map((m) => {
      return {
        id: m.id,
        uid: m.uid,
        uniqueId: m.business_phone_number_id || `meta_${m.id}`,
        title: `Meta Cloud API (${m.business_phone_number_id || m.waba_id})`,
        number: m.business_phone_number_id || "Cloud API",
        type: "META",
        status: "ACTIVE", // Meta Cloud API operates via webhook endpoints
        isLiveSession: true,
        createdAt: m.createdAt,
        owner: {
          name: m.owner_name || "Unknown",
          email: m.owner_email || "N/A",
          isBlocked: Boolean(m.owner_blocked),
        },
      };
    });

    let combined = [];
    if (type === "QR") combined = formattedQr;
    else if (type === "META") combined = formattedMeta;
    else combined = [...formattedQr, ...formattedMeta];

    if (status && status !== "ALL") {
      combined = combined.filter((i) => i.status.toUpperCase() === status.toUpperCase());
    }

    res.json({
      success: true,
      data: combined,
      summary: {
        total: formattedQr.length + formattedMeta.length,
        qrCount: formattedQr.length,
        metaCount: formattedMeta.length,
        activeCount: formattedQr.filter((q) => q.status === "ACTIVE").length + formattedMeta.length,
        disconnectedCount: formattedQr.filter((q) => q.status !== "ACTIVE").length,
      },
    });
  } catch (err) {
    logger.error("get_all_instances error:", err);
    res.status(500).json({ success: false, msg: "Failed to retrieve WhatsApp instances", error: err.message });
  }
});

// ─── GOD-MODE DISCONNECT / DELETE WHATSAPP INSTANCE ─────────────────────────
router.post("/disconnect_instance", adminValidator, async (req, res) => {
  try {
    const { uniqueId, type } = req.body;
    if (!uniqueId) {
      return res.status(400).json({ success: false, msg: "uniqueId is required" });
    }

    if (type === "QR") {
      const qrHelper = getQrHelper();
      const session = qrHelper.getSession ? qrHelper.getSession(uniqueId) : null;
      if (session) {
        try {
          await session.logout();
        } catch (_) {}
        if (qrHelper.deleteSession) qrHelper.deleteSession(uniqueId);
      }
      await query(`UPDATE instance SET status = 'INACTIVE', qr = NULL WHERE uniqueId = ?`, [uniqueId]);

      // Audit Log
      await query(
        `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
        [req.decode?.uid || "admin", "DISCONNECT_INSTANCE", "WHATSAPP", uniqueId, JSON.stringify({ type: "QR" })]
      );

      return res.json({ success: true, msg: `Instance ${uniqueId} disconnected successfully` });
    } else {
      return res.status(400).json({ success: false, msg: "Meta Cloud API instances cannot be disconnected this way" });
    }
  } catch (err) {
    logger.error("disconnect_instance error:", err);
    res.status(500).json({ success: false, msg: "Failed to disconnect instance", error: err.message });
  }
});

router.post("/del_instance", adminValidator, async (req, res) => {
  try {
    const { id, uniqueId, type } = req.body;
    if (!id && !uniqueId) {
      return res.status(400).json({ success: false, msg: "id or uniqueId is required" });
    }

    if (type === "META") {
      await query(`DELETE FROM meta_api WHERE id = ? OR waba_id = ?`, [id, uniqueId]);
      await query(
        `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
        [req.decode?.uid || "admin", "DELETE_META_INSTANCE", "WHATSAPP", String(id || uniqueId), JSON.stringify({ type: "META" })]
      );
      return res.json({ success: true, msg: "Meta API integration removed" });
    } else {
      const uId = uniqueId;
      if (uId) {
        const qrHelper = getQrHelper();
        const session = qrHelper.getSession ? qrHelper.getSession(uId) : null;
        if (session) {
          try {
            await session.logout();
          } catch (_) {}
          if (qrHelper.deleteSession) qrHelper.deleteSession(uId);
        }
        await query(`DELETE FROM instance WHERE uniqueId = ? OR id = ?`, [uId, id]);
      } else {
        await query(`DELETE FROM instance WHERE id = ?`, [id]);
      }

      await query(
        `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
        [req.decode?.uid || "admin", "DELETE_QR_INSTANCE", "WHATSAPP", String(uniqueId || id), JSON.stringify({ type: "QR" })]
      );

      return res.json({ success: true, msg: "WhatsApp instance removed permanently" });
    }
  } catch (err) {
    logger.error("del_instance error:", err);
    res.status(500).json({ success: false, msg: "Failed to remove instance", error: err.message });
  }
});

// ─── GOD-MODE SUBSCRIPTIONS INSPECTOR ───────────────────────────────────────
router.get("/get_subscriptions", adminValidator, async (req, res) => {
  try {
    const usersWithPlan = await query(
      `SELECT u.id, u.uid, u.name, u.email, u.plan, u.plan_expire, u.subscription_id, 
              u.subscription_status, u.is_blocked, u.createdAt,
              (SELECT MAX(o.createdAt) FROM orders o WHERE o.uid = u.uid AND o.status IN ('PAID', 'SUCCESS', 'paid')) as lastPaidAt,
              (SELECT o.amount FROM orders o WHERE o.uid = u.uid AND o.status IN ('PAID', 'SUCCESS', 'paid') ORDER BY o.id DESC LIMIT 1) as lastAmount,
              (SELECT o.data FROM orders o WHERE o.uid = u.uid AND o.status IN ('PAID', 'SUCCESS', 'paid') ORDER BY o.id DESC LIMIT 1) as lastOrderData,
              (SELECT o.payment_mode FROM orders o WHERE o.uid = u.uid ORDER BY o.id DESC LIMIT 1) as paymentMode
       FROM user u
       WHERE u.plan IS NOT NULL AND u.plan != ''
       ORDER BY u.id DESC`
    );

    const now = moment();
    const { getCurrencySettings } = require("../helper/pricing");
    const { baseCode } = await getCurrencySettings();
    const formatted = usersWithPlan.map((u) => {
      let planObj = null;
      try {
        planObj = typeof u.plan === "string" ? JSON.parse(u.plan) : u.plan;
      } catch (_) {}

      const planTitle = planObj?.title || "Custom Plan";
      const isTrial = Boolean(planObj?.is_trial);

      // Expiry wins over the stored subscription_status, which is never reset when a plan lapses
      let isExpired = false;
      if (u.plan_expire) {
        const rawExpire = !isNaN(Number(u.plan_expire)) ? Number(u.plan_expire) : u.plan_expire;
        const exp = moment(rawExpire);
        isExpired = exp.isValid() && exp.isBefore(now);
      }
      let status = isTrial ? "TRIALING" : "ACTIVE";
      if (u.is_blocked) {
        status = "SUSPENDED";
      } else if (isExpired) {
        status = "EXPIRED";
      } else if (u.subscription_status) {
        status = u.subscription_status.toUpperCase();
      }
      let lastOrder = {};
      try {
        lastOrder = JSON.parse(u.lastOrderData || "{}");
      } catch (_) {}

      return {
        id: u.id,
        uid: u.uid,
        userName: u.name || "Customer",
        userEmail: u.email,
        planTitle,
        isTrial,
        planDurationDays: planObj?.plan_duration_in_days || 30,
        price: isTrial ? 0 : Number(u.lastAmount || 0),
        currency: String(lastOrder?.currency || baseCode).toUpperCase(),
        status,
        planExpire: u.plan_expire,
        subscriptionId: u.subscription_id || null,
        paymentMode: u.paymentMode || "MANUAL",
        lastPaidAt: u.lastPaidAt || null,
        createdAt: u.createdAt,
      };
    });

    res.json({
      success: true,
      data: formatted,
      summary: {
        total: formatted.length,
        active: formatted.filter((s) => s.status === "ACTIVE").length,
        trialing: formatted.filter((s) => s.status === "TRIALING").length,
        expired: formatted.filter((s) => s.status === "EXPIRED").length,
        suspended: formatted.filter((s) => s.status === "SUSPENDED").length,
      },
    });
  } catch (err) {
    logger.error("get_subscriptions error:", err);
    res.status(500).json({ success: false, msg: "Failed to load subscriptions", error: err.message });
  }
});

// ─── GOD-MODE USAGE & ENTITLEMENTS SUMMARY ──────────────────────────────────
router.get("/get_usage_summary", adminValidator, async (req, res) => {
  try {
    const tenants = await query(
      `SELECT 
        u.id, u.uid, u.name, u.email, u.plan, u.plan_expire,
        (SELECT COUNT(*) FROM contact c WHERE c.uid = u.uid) as contactCount,
        (SELECT COUNT(*) FROM instance i WHERE i.uid = u.uid AND i.status = 'ACTIVE') as instanceCount,
        (SELECT COUNT(*) FROM beta_chatbot b WHERE b.uid = u.uid AND b.active = 1) as activeChatbots,
        (SELECT COUNT(*) FROM beta_campaign bc WHERE bc.uid = u.uid) as campaignCount
      FROM user u
      WHERE u.is_blocked = 0 OR u.is_blocked IS NULL
      ORDER BY contactCount DESC
      LIMIT 1000`
    );

    const formatted = tenants.map((t) => {
      let parsedPlan = null;
      try {
        parsedPlan = t.plan ? (typeof t.plan === "string" ? JSON.parse(t.plan) : t.plan) : null;
      } catch (_) {}

      // Same numbers the entitlement checks use; no plan means no allowance (not invented defaults)
      const hasPlan = Boolean(parsedPlan?.title);
      const expireAt = Number(t.plan_expire);
      const planExpired = hasPlan && (!Number.isFinite(expireAt) || expireAt <= Date.now());
      const contactLimit = hasPlan ? parseInt(parsedPlan?.contact_limit, 10) || 0 : 0;
      const instanceLimit = hasPlan ? parseInt(parsedPlan?.qr_account, 10) || 0 : 0;
      const chatbotAllowed = hasPlan && Boolean(Number(parsedPlan?.allow_chatbot));

      const pct = (used, limit) => (limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : used > 0 ? 100 : 0);
      const contactPercent = pct(Number(t.contactCount || 0), contactLimit);
      const instancePercent = pct(Number(t.instanceCount || 0), instanceLimit);

      let usageRisk = "NORMAL";
      if (!hasPlan) {
        usageRisk = "NO_PLAN";
      } else if (planExpired) {
        usageRisk = "EXPIRED";
      } else if (contactPercent >= 100 || instancePercent >= 100) {
        usageRisk = "LIMIT_REACHED";
      } else if (contactPercent >= 80 || instancePercent >= 80) {
        usageRisk = "NEAR_LIMIT";
      }

      return {
        id: t.id,
        uid: t.uid,
        name: t.name || "Customer",
        email: t.email,
        planTitle: parsedPlan?.title || "No plan",
        planExpired,
        usageRisk,
        contacts: {
          used: Number(t.contactCount || 0),
          limit: contactLimit,
          percent: contactPercent,
        },
        instances: {
          used: Number(t.instanceCount || 0),
          limit: instanceLimit,
          percent: instancePercent,
        },
        chatbots: {
          activeCount: Number(t.activeChatbots || 0),
          allowed: chatbotAllowed,
        },
        campaigns: Number(t.campaignCount || 0),
      };
    });

    res.json({
      success: true,
      data: formatted,
      summary: {
        totalInspected: formatted.length,
        nearLimit: formatted.filter((f) => f.usageRisk === "NEAR_LIMIT").length,
        limitReached: formatted.filter((f) => f.usageRisk === "LIMIT_REACHED").length,
        noPlan: formatted.filter((f) => f.usageRisk === "NO_PLAN").length,
        expired: formatted.filter((f) => f.usageRisk === "EXPIRED").length,
      },
    });
  } catch (err) {
    logger.error("get_usage_summary error:", err);
    res.status(500).json({ success: false, msg: "Failed to load usage summary", error: err.message });
  }
});

module.exports = router;

