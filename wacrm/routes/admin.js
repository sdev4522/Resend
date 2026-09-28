const router = require("express").Router();
const { query } = require("../database/dbpromise.js");
const randomstring = require("randomstring");
const bcrypt = require("bcrypt");
const { sign } = require("jsonwebtoken");
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

function getQrHelper() {
  return require("../helper/addon/qr/index.js");
}


router.post("/login", authRateLimiter({ limit: 10, prefix: "admin_login" }), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Please fill email and password",
      });
    }

    const userFind = await query(`SELECT * FROM admin WHERE email = ?`, [
      email,
    ]);
    if (userFind.length < 1) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
    }

    const compare = await bcrypt.compare(password, userFind[0].password);
    if (!compare) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
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
    res.status(500).json({ success: false, msg: "Internal server error" });
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
      custom,
    } = req.body;

    if (!title || !short_description || !plan_duration_in_days) {
      return res.json({ success: false, msg: "Please fill details" });
    }

    const customVal = custom ? (typeof custom === "object" ? JSON.stringify(custom) : String(custom)) : null;

    const insertRes = await query(
      `INSERT INTO plan (title, short_description, allow_tag, allow_note, allow_chatbot, 
        contact_limit, allow_api, is_trial, price, price_strike, plan_duration_in_days, 
        qr_account, wa_warmer, rest_api_qr, instagram_inbox, telegram_inbox, allow_wa_forms, custom) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        short_description,
        allow_tag ? 1 : 0,
        allow_note ? 1 : 0,
        allow_chatbot ? 1 : 0,
        parseInt(contact_limit || 0),
        allow_api ? 1 : 0,
        is_trial ? 1 : 0,
        is_trial ? 0 : price,
        price_strike,
        parseInt(plan_duration_in_days || 1),
        parseInt(qr_account) > 0 ? parseInt(qr_account) : 0,
        wa_warmer ? 1 : 0,
        rest_api_qr ? 1 : 0,
        instagram_inbox ? 1 : 0,
        telegram_inbox ? 1 : 0,
        allow_wa_forms ? 1 : 0,
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
          is_trial ? 0 : parseFloat(price || 0),
          price_strike ? parseFloat(price_strike) : null,
          parseInt(plan_duration_in_days || 30, 10),
        ]
      );
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
      custom,
    } = req.body;

    if (!id) return res.json({ success: false, msg: "Plan ID is required" });
    if (!title || !short_description || !plan_duration_in_days)
      return res.json({ success: false, msg: "Please fill all details" });

    const customVal = custom ? (typeof custom === "object" ? JSON.stringify(custom) : String(custom)) : null;

    await query(
      `UPDATE plan SET 
        title = ?, short_description = ?, allow_tag = ?, allow_note = ?,
        allow_chatbot = ?, contact_limit = ?, allow_api = ?, is_trial = ?,
        price = ?, price_strike = ?, plan_duration_in_days = ?,
        qr_account = ?, wa_warmer = ?, rest_api_qr = ?,
        instagram_inbox = ?, telegram_inbox = ?,
        allow_wa_forms = ?, custom = ?
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
        is_trial ? 0 : price,
        price_strike,
        parseInt(plan_duration_in_days || 1),
        parseInt(qr_account) > 0 ? parseInt(qr_account) : 0,
        wa_warmer ? 1 : 0,
        rest_api_qr ? 1 : 0,
        instagram_inbox ? 1 : 0,
        telegram_inbox ? 1 : 0,
        allow_wa_forms ? 1 : 0,
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
        is_trial ? 0 : parseFloat(price || 0),
        price_strike ? parseFloat(price_strike) : null,
        parseInt(plan_duration_in_days || 30, 10),
      ]
    );

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

    await query(`DELETE FROM plan WHERE id = ?`, [id]);
    res.json({ success: true, msg: "Plan was deleted" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all users (supports optional server-side pagination & search)
router.get("/get_users", adminValidator, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit))) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;

    let sql = `SELECT id, role, uid, name, email, mobile_with_country_code, timezone, plan, plan_expire, trial, createdAt, tokenVersion, subscription_id, subscription_status, is_blocked FROM user`;
    const params = [];

    if (search) {
      sql += ` WHERE (name LIKE ? OR email LIKE ? OR mobile_with_country_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id DESC`;

    if (limit) {
      const offset = (page - 1) * limit;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const data = await query(sql, params);
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get detailed user inspector for admin
router.get("/get_user_details", adminValidator, async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, msg: "User UID is required" });
    }

    const [user] = await query(
      `SELECT id, role, uid, name, email, mobile_with_country_code, timezone, plan, plan_expire, trial, createdAt, subscription_id, subscription_status, is_blocked 
       FROM user WHERE uid = ?`,
      [uid]
    );

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Related counts & lists
    const [instances, contacts, campaigns, flows, chatbots, orders] = await Promise.all([
      query(`SELECT id, title, number, uniqueId, status, createdAt FROM instance WHERE uid = ?`, [uid]),
      query(`SELECT COUNT(*) as count FROM contact WHERE uid = ?`, [uid]),
      query(`SELECT id, title, status, total_contacts, sent_count, delivered_count, failed_count, createdAt FROM beta_campaign WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
      query(`SELECT id, flow_id, name, source, createdAt FROM beta_flows WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
      query(`SELECT id, title, active, createdAt FROM beta_chatbot WHERE uid = ? ORDER BY id DESC`, [uid]),
      query(`SELECT id, amount, status, payment_mode, createdAt FROM orders WHERE uid = ? ORDER BY id DESC LIMIT 10`, [uid]),
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
          ordersCount: orders.length,
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

    const [user] = await query(`SELECT uid, email, name FROM user WHERE uid = ?`, [uid]);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Invalidate existing sessions immediately via tokenVersion bump
    await query(
      `UPDATE user 
       SET is_blocked = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 
       WHERE uid = ?`,
      [blockedVal, uid]
    );

    // Audit log
    await query(
      `INSERT INTO admin_audit_logs (admin_uid, action, target_type, target_id, details) VALUES (?,?,?,?,?)`,
      [
        req.decode?.uid || "admin",
        blockedVal ? "USER_BLOCK" : "USER_UNBLOCK",
        "USER",
        uid,
        JSON.stringify({ email: user.email, name: user.name, is_blocked: blockedVal }),
      ]
    );

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
    const { newPassword, name, email, mobile_with_country_code, uid } =
      req.body;

    if (!uid || !name || !email || !mobile_with_country_code) {
      return res.json({
        success: false,
        msg: "You forgot to enter some field(s)",
      });
    }

    const findUserByEmail = await query(`SELECT * FROM user WHERE email = ?`, [
      email,
    ]);

    if (findUserByEmail.length > 0 && findUserByEmail[0].uid !== uid) {
      return res.json({
        success: false,
        msg: "This email is already taken by another user",
      });
    }

    const findUserByUid = await query(`SELECT * FROM user WHERE uid = ?`, [
      uid,
    ]);

    if (findUserByUid.length === 0) {
      return res.json({
        success: false,
        msg: "User not found",
      });
    }

    if (newPassword) {
      const hashpass = await bcrypt.hash(newPassword, 10);

      await query(
        `UPDATE user 
         SET name = ?, email = ?, password = ?, mobile_with_country_code = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 
         WHERE uid = ?`,
        [name, email, hashpass, mobile_with_country_code, uid],
      );
    } else {
      await query(
        `UPDATE user 
         SET name = ?, email = ?, mobile_with_country_code = ? 
         WHERE uid = ?`,
        [name, email, mobile_with_country_code, uid],
      );
    }

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
    const { plan, uid } = req.body;

    if (!plan || !uid) {
      return res.json({ success: false, msg: "Invalid input provided" });
    }

    const getPlan = await query(`SELECT * FROM plan WHERE id = ?`, [plan?.id]);
    if (getPlan.length < 1) {
      return res.json({ success: false, msg: "Invalid plan found" });
    }

    await updateUserPlan(getPlan[0], uid);

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
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET || webPrivate?.rz_webhook_secret || "";

    res.json({
      success: true,
      data: {
        rz_id: keyId,
        rz_active: webPrivate?.rz_active == "1",
        has_rz_key: hasKey,
        rz_webhook_secret: webhookSecret,
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

    if (rz_key && rz_key.trim() !== "") {
      await query(
        `UPDATE web_private SET rz_id = ?, rz_key = ?, rz_active = ?, rz_webhook_secret = ?`,
        [
          rz_id ? rz_id.trim() : "",
          rz_key.trim(),
          rz_active ? "1" : "0",
          rz_webhook_secret ? rz_webhook_secret.trim() : "",
        ]
      );
    } else {
      await query(
        `UPDATE web_private SET rz_id = ?, rz_active = ?, rz_webhook_secret = ?`,
        [
          rz_id ? rz_id.trim() : "",
          rz_active ? "1" : "0",
          rz_webhook_secret ? rz_webhook_secret.trim() : "",
        ]
      );
    }

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

    for (const item of prices) {
      const planId = parseInt(item.plan_id, 10);
      const currencyCode = (item.currency_code || "").trim().toUpperCase();
      const amount = parseFloat(item.amount);
      const strikeAmount =
        item.strike_amount !== null && item.strike_amount !== undefined && item.strike_amount !== ""
          ? parseFloat(item.strike_amount)
          : null;
      const billingDays = parseInt(item.billing_period_days || 30, 10);
      const isActive = item.is_active === false ? 0 : 1;

      if (!planId || !currencyCode || isNaN(amount)) {
        continue;
      }

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

    res.json({ success: true, msg: "Plan prices matrix saved successfully" });
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
       ORDER BY o.createdAt DESC LIMIT 100`
    );

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
        currency: parsedData?.currency || "USD",
        razorpayPaymentId: parsedData?.razorpayPaymentId || null,
      };
    });

    res.json({ success: true, orders: formatted });
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

    await query(`INSERT INTO faq (question, answer) VALUES (?,?)`, [
      question,
      answer,
    ]);

    res.json({ success: true, msg: "Faq was added" });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// get all faq
router.get("/get_faq", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM faq`, []);
    res.json({ data, success: true });
  } catch (err) {
    res.json({ success: false, msg: "something went wrong" });
    logger.log(err);
  }
});

// del faq
router.post("/del_faq", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    await query(`DELETE FROM faq WHERE id = ?`, [id]);
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

    const user = await query(`SELECT * FROM user WHERE uid = ?`, [uid]);
    if (user.length < 1) {
      return res.json({ success: false, msg: "User not found" });
    }

    // ✅ No password in token — uses tokenVersion instead
    const token = sign(
      {
        uid: user[0].uid,
        role: "user",
        email: user[0].email,
        tokenVersion: user[0].tokenVersion ?? 0,
      },
      process.env.JWTKEY,
      {},
    );

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

    await query(
      `INSERT INTO testimonial (title, description, reviewer_name, reviewer_position) VALUES (?,?,?,?)`,
      [title, description, reviewer_name, reviewer_position],
    );

    res.json({ success: true, msg: "Testimonial was added" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// get all testi
router.get("/get_testi", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM testimonial`, []);
    res.json({ success: true, data });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "server error", err });
  }
});

// del testi
router.post("/del_testi", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;

    await query(`DELETE FROM testimonial WHERE id = ?`, [id]);
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
    const { email, port, password, host, username } = req.body;

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
    const { email, port, password, host, to, username } = req.body;

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
      `<h1>WACRM SMTP Test Successful</h1><p>Your SMTP credentials are configured correctly and active.</p>`,
      "WACRM SMTP Testing",
      "WACRM System",
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
    const getOrders = await query(`SELECT id, uid, amount, createdAt FROM orders`, []);
    const orders = getUserOrderssByMonth(getOrders);

    // Get contact form count
    const [contactFormCount] = await query(`SELECT COUNT(*) AS count FROM contact_form`, []);

    // Get chats data (selective projection)
    const getChats = await query(`SELECT createdAt FROM beta_chats`, []);
    const chatsByMonth = getChatsByMonth(getChats);

    // Get conversations data (selective projection)
    const getConversations = await query(`SELECT type, createdAt FROM beta_conversation`, []);
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
    const systemMetrics = {
      serverLoad: Math.floor(Math.random() * 60) + 20, // Simulated data between 20-80%
      memoryUsage: Math.floor(Math.random() * 40) + 30, // Simulated data between 30-70%
      diskSpace: Math.floor(Math.random() * 30) + 10, // Simulated data between 10-40%
      activeSessions:
        getUsers.length > 0 ? Math.floor(getUsers.length * 0.7) : 0,
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
        return {
          id: order.id,
          user: user ? user.name : "Unknown",
          amount: `$${order.amount}`,
          plan: "Subscription",
          status: "Completed",
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
    const month = createdAt.getMonth();

    // Check if user has a paid plan
    const plan = JSON.parse(user.plan || "{}");
    const isPaid = plan && plan.is_trial === 0;

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
    const agentTasks = tasks.filter((task) => task.uid === agent.uid);
    const completedTasks = agentTasks.filter(
      (task) => task.status === "COMPLETED",
    ).length;
    const completionRate =
      agentTasks.length > 0 ? (completedTasks / agentTasks.length) * 100 : 0;

    // Generate some random metrics for demo purposes
    return {
      name: agent.name,
      data: [
        Math.floor(Math.random() * 30) + 70, // Response time (70-100)
        completionRate || Math.floor(Math.random() * 20) + 75, // Resolution rate
        Math.floor(Math.random() * 15) + 80, // Customer rating
        Math.floor(Math.random() * 25) + 70, // Chats handled
        Math.floor(Math.random() * 20) + 75, // Tasks completed
      ],
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
router.post("/send_resovery", async (req, res) => {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.json({ msg: "Please enter a valid email" });
    }

    const checkEmailValid = await query(`SELECT * FROM admin WHERE email = ?`, [
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

    const jsontoken = sign(
      {
        old_email: email,
        email: email,
        time: moment(new Date()),
        role: "admin",
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
      msg: "We have sent your a password recovery link. Please check your email",
    });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

router.get("/modify_password", adminValidator, async (req, res) => {
  try {
    const { pass } = req.query;

    if (!pass) {
      return res.json({ success: false, msg: "Please provides a password" });
    }

    if (moment(req.decode.time).diff(moment(new Date()), "hours") > 1) {
      return res.json({ success: false, msg: "Token expired" });
    }

    const hashpassword = await bcrypt.hash(pass, 10);

    // ✅ Bump tokenVersion on password reset
    await query(
      `UPDATE admin SET password = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE email = ?`,
      [hashpassword, req.decode.old_email],
    );

    res.json({
      success: true,
      msg: "Your password has been changed. You may login now! Redirecting...",
    });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
  }
});

// del user
router.post("/del_user", adminValidator, async (req, res) => {
  try {
    const { id } = req.body;
    const [user] = await query(`SELECT * FROM user WHERE id = ?`, [id]);
    if (!user) {
      return res.json({ msg: "User not found", success: false });
    }

    await query(`DELETE FROM user WHERE uid = ?`, [user.uid]);

    await query(`DELETE FROM meta_api WHERE uid = ?`, [user.uid]);
    res.json({ success: true, msg: "User was deleted" });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
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

// get social login
router.get("/get_social_login", async (req, res) => {
  try {
    const data = await query(`SELECT * FROM web_public`, []);
    res.json({ data: data[0], success: true });
  } catch (err) {
    logger.log(err);
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
      `UPDATE web_public SET google_client_id = ?, google_login_active = ?, fb_login_app_id = ?, fb_login_app_sec = ?, fb_login_active = ?`,
      [
        google_client_id,
        google_login_active,
        fb_login_app_id,
        fb_login_app_sec,
        fb_login_active,
      ],
    );

    res.json({ msg: "Settings updated", success: true });
  } catch (err) {
    logger.log(err);
    res.json({ msg: "Something went wrong", err, success: false });
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
          const appName = "WACRM";
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
      app_name: "WACRM",
      reset_link: "https://wacrm.io/recovery-user/sample-token-123",
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
              (SELECT o.payment_mode FROM orders o WHERE o.uid = u.uid ORDER BY o.id DESC LIMIT 1) as paymentMode
       FROM user u
       WHERE u.plan IS NOT NULL AND u.plan != ''
       ORDER BY u.id DESC`
    );

    const now = moment();
    const formatted = usersWithPlan.map((u) => {
      let planObj = null;
      try {
        planObj = typeof u.plan === "string" ? JSON.parse(u.plan) : u.plan;
      } catch (_) {}

      const planTitle = planObj?.title || "Custom Plan";
      const isTrial = Boolean(planObj?.is_trial);

      let status = "ACTIVE";
      if (u.is_blocked) {
        status = "SUSPENDED";
      } else if (u.subscription_status) {
        status = u.subscription_status.toUpperCase();
      } else if (u.plan_expire) {
        const rawExpire = !isNaN(Number(u.plan_expire)) ? Number(u.plan_expire) : u.plan_expire;
        const exp = moment(rawExpire);
        if (exp.isValid() && exp.isBefore(now)) {
          status = "EXPIRED";
        }
      }

      return {
        id: u.id,
        uid: u.uid,
        userName: u.name || "Customer",
        userEmail: u.email,
        planTitle,
        isTrial,
        planDurationDays: planObj?.plan_duration_in_days || 30,
        price: u.lastAmount || planObj?.price || 0,
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
        (SELECT COUNT(*) FROM instance i WHERE i.uid = u.uid) as instanceCount,
        (SELECT COUNT(*) FROM beta_chatbot b WHERE b.uid = u.uid AND b.active = 1) as activeChatbots,
        (SELECT COUNT(*) FROM beta_campaign bc WHERE bc.uid = u.uid) as campaignCount
      FROM user u
      WHERE u.is_blocked = 0 OR u.is_blocked IS NULL
      ORDER BY contactCount DESC
      LIMIT 100`
    );

    const formatted = tenants.map((t) => {
      let parsedPlan = null;
      try {
        parsedPlan = t.plan ? (typeof t.plan === "string" ? JSON.parse(t.plan) : t.plan) : null;
      } catch (_) {}

      const contactLimit = parseInt(parsedPlan?.contact_limit || 1000, 10);
      const instanceLimit = parseInt(parsedPlan?.qr_account || 1, 10);
      const chatbotAllowed = Boolean(parsedPlan?.allow_chatbot);

      const contactPercent = Math.min(Math.round(((t.contactCount || 0) / (contactLimit || 1)) * 100), 100);
      const instancePercent = Math.min(Math.round(((t.instanceCount || 0) / (instanceLimit || 1)) * 100), 100);

      let usageRisk = "NORMAL";
      if (contactPercent >= 100 || instancePercent >= 100) {
        usageRisk = "LIMIT_REACHED";
      } else if (contactPercent >= 80 || instancePercent >= 80) {
        usageRisk = "NEAR_LIMIT";
      }

      return {
        id: t.id,
        uid: t.uid,
        name: t.name || "Customer",
        email: t.email,
        planTitle: parsedPlan?.title || "Standard Tier",
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
      },
    });
  } catch (err) {
    logger.error("get_usage_summary error:", err);
    res.status(500).json({ success: false, msg: "Failed to load usage summary", error: err.message });
  }
});

module.exports = router;

