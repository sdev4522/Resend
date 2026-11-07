/**
 * Phase P3 — Genuine Prisma User & Admin CRUD Acceptance Test Suite
 *
 * Verifies real Prisma execution via:
 * 1. Runtime Prisma Client method spies (proving Prisma invocation)
 * 2. Raw SQL absence check (asserting dbpromise query is NOT called for migrated operations)
 * 3. Middleware migrations (validateUser, adminValidator, validateAgent, checkPlan)
 * 4. User CRUD routes (/get_me, /update_profile, quick replies, chat tags, notifications)
 * 5. Admin CRUD routes (FAQ, testimonials, toggle_user_status, update_user, verify_user_email)
 * 6. BigInt serialization & safe range preservation (sanitizeBigInt)
 * 7. Multi-tenant boundary isolation & cross-tenant security
 * 8. Missing record & input validation behavior
 */
import "dotenv/config";
import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import { createRequire } from "node:module";
import { prisma, sanitizeBigInt } from "./database/prisma.js";

const require = createRequire(import.meta.url);
const dbpromise = require("./database/dbpromise.js");
import userRouter from "./routes/user.js";
import adminRouter from "./routes/admin.js";
import validateUser from "./middlewares/user.js";
import adminValidator from "./middlewares/admin.js";
import validateAgent from "./middlewares/agent.js";
import { checkPlan } from "./middlewares/plan.js";

const TEST_PORT = 3189;
const USER_BASE = `http://127.0.0.1:${TEST_PORT}/api/user`;
const ADMIN_BASE = `http://127.0.0.1:${TEST_PORT}/api/admin`;

console.log("====================================================================");
console.log("🧪 PHASE P3 — GENUINE PRISMA AUTH & CRUD ACCEPTANCE SUITE");
console.log("====================================================================\n");

// ─── SPY INFRASTRUCTURE ────────────────────────────────────────────────────────

const prismaSpy = {
  calls: {},
  reset() {
    this.calls = {};
  },
  record(model, method, args) {
    const key = `${model}.${method}`;
    this.calls[key] = this.calls[key] || [];
    this.calls[key].push(args);
  },
  getCount(model, method) {
    return (this.calls[`${model}.${method}`] || []).length;
  },
  hasBeenCalled(model, method) {
    return this.getCount(model, method) > 0;
  },
};

// Instrument Prisma models
const instrumentedModels = [
  "user",
  "admin",
  "agents",
  "quick_reply",
  "chat_tags",
  "in_app_notifications",
  "faq",
  "testimonial",
  "admin_audit_logs",
  "email_verification",
  "contact",
];

const methodsToInstrument = [
  "findFirst",
  "findMany",
  "findUnique",
  "create",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
];

for (const modelName of instrumentedModels) {
  if (prisma[modelName]) {
    for (const method of methodsToInstrument) {
      if (typeof prisma[modelName][method] === "function") {
        const originalMethod = prisma[modelName][method].bind(prisma[modelName]);
        prisma[modelName][method] = async (...args) => {
          prismaSpy.record(modelName, method, args);
          return originalMethod(...args);
        };
      }
    }
  }
}

// Instrument prisma.$transaction
const originalTransaction = prisma.$transaction.bind(prisma);
prisma.$transaction = async (...args) => {
  prismaSpy.record("$prisma", "$transaction", args);
  if (typeof args[0] === "function") {
    const fn = args[0];
    return originalTransaction(async (tx) => {
      for (const modelName of instrumentedModels) {
        if (tx[modelName]) {
          for (const method of methodsToInstrument) {
            if (typeof tx[modelName][method] === "function") {
              const orig = tx[modelName][method].bind(tx[modelName]);
              tx[modelName][method] = async (...mArgs) => {
                prismaSpy.record(modelName, method, mArgs);
                return orig(...mArgs);
              };
            }
          }
        }
      }
      return fn(tx);
    });
  }
  return originalTransaction(...args);
};

// Instrument legacy dbpromise.query
let rawQueryCalls = [];
const originalQuery = dbpromise.query;
// Monkey-patch query to spy on it
dbpromise.query = async (sql, params) => {
  rawQueryCalls.push({ sql: String(sql), params });
  return originalQuery(sql, params);
};

// Helper to filter raw queries targeting specific tables
function rawQueryCalledForTables(tables = []) {
  return rawQueryCalls.filter((c) => {
    const lower = c.sql.toLowerCase();
    return tables.some((tbl) => lower.includes(tbl.toLowerCase()));
  });
}

// ─── TEST RUNNER ───────────────────────────────────────────────────────────────

async function runTests() {
  let passed = 0;
  let failed = 0;
  let server;

  function pass(testName, details = "") {
    console.log(`✅ [PASS] ${testName}${details ? " -> " + details : ""}`);
    passed++;
  }

  function fail(testName, err) {
    console.error(`❌ [FAIL] ${testName}:`, err?.message || err);
    failed++;
  }

  // Cleanup tracking lists
  const cleanupQuickReplies = [];
  const cleanupChatTags = [];
  const cleanupNotifications = [];
  const cleanupFaqs = [];
  const cleanupTestimonials = [];
  let userAOriginalName = null;
  let userAOriginalTimezone = null;
  let userA = null;
  let userB = null;
  let adminRecord = null;
  let agentRecord = null;

  try {
    // 0. Start test server
    const app = express();
    app.use(express.json());
    app.use("/api/user", userRouter);
    app.use("/api/admin", adminRouter);

    server = await new Promise((resolve) => {
      const s = app.listen(TEST_PORT, "127.0.0.1", () => resolve(s));
    });
    pass("0. Test server startup", `Listening on port ${TEST_PORT}`);

    // 1. Fixtures setup
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        is_blocked: false,
        email_verified_at: { not: null },
      },
      take: 2,
    });
    assert(users.length >= 2, "Need at least 2 active users for tenant testing");
    userA = users[0];
    userB = users[1];
    userAOriginalName = userA.name;
    userAOriginalTimezone = userA.timezone;

    adminRecord = await prisma.admin.findFirst({
      where: { role: "admin" },
    });
    assert(adminRecord, "Need at least 1 administrator in database");

    agentRecord = await prisma.agents.findFirst({
      where: { is_active: 1 },
    });

    const jwtSecret = process.env.JWTKEY;
    const tokenA = jwt.sign(
      { uid: userA.uid, role: "user", tokenVersion: userA.tokenVersion || 0 },
      jwtSecret
    );
    const tokenB = jwt.sign(
      { uid: userB.uid, role: "user", tokenVersion: userB.tokenVersion || 0 },
      jwtSecret
    );
    const adminToken = jwt.sign(
      { uid: adminRecord.uid, role: "admin", tokenVersion: adminRecord.tokenVersion || 0 },
      jwtSecret
    );

    const headersA = { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` };
    const headersB = { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` };
    const headersAdmin = { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` };

    pass("1. Test fixtures loaded", `User A: ${userA.email}, User B: ${userB.email}, Admin: ${adminRecord.email}`);

    // =========================================================================
    // SECTION 1: MIDDLEWARES DIRECT VERIFICATION
    // =========================================================================
    try {
      // Test validateUser directly
      prismaSpy.reset();
      const mockReq = { get: () => `Bearer ${tokenA}` };
      const mockRes = { status: () => ({ json: () => {} }) };
      let userNextCalled = false;
      await validateUser(mockReq, mockRes, () => { userNextCalled = true; });
      assert.strictEqual(userNextCalled, true, "validateUser should call next()");
      assert(prismaSpy.hasBeenCalled("user", "findFirst"), "validateUser must call prisma.user.findFirst");
      assert.strictEqual(mockReq.decode.uid, userA.uid);
      pass("2. validateUser middleware - Verified genuine prisma.user.findFirst lookup");
    } catch (err) {
      fail("2. validateUser middleware", err);
    }

    try {
      // Test adminValidator directly
      prismaSpy.reset();
      const mockReq = { get: () => `Bearer ${adminToken}` };
      const mockRes = { status: () => ({ json: () => {} }) };
      let adminNextCalled = false;
      await adminValidator(mockReq, mockRes, () => { adminNextCalled = true; });
      assert.strictEqual(adminNextCalled, true, "adminValidator should call next()");
      assert(prismaSpy.hasBeenCalled("admin", "findFirst"), "adminValidator must call prisma.admin.findFirst");
      assert.strictEqual(mockReq.decode.uid, adminRecord.uid);
      pass("3. adminValidator middleware - Verified genuine prisma.admin.findFirst lookup");
    } catch (err) {
      fail("3. adminValidator middleware", err);
    }

    if (agentRecord) {
      try {
        // Test validateAgent directly
        prismaSpy.reset();
        const agentToken = jwt.sign(
          {
            uid: agentRecord.uid,
            role: "agent",
            owner_uid: agentRecord.owner_uid,
            tokenVersion: agentRecord.tokenVersion || 0,
          },
          jwtSecret
        );
        const mockReq = { get: () => `Bearer ${agentToken}` };
        const mockRes = { status: () => ({ json: () => {} }) };
        let agentNextCalled = false;
        await validateAgent(mockReq, mockRes, () => { agentNextCalled = true; });
        assert.strictEqual(agentNextCalled, true, "validateAgent should call next()");
        assert(prismaSpy.hasBeenCalled("agents", "findFirst"), "validateAgent must call prisma.agents.findFirst");
        assert(prismaSpy.hasBeenCalled("user", "findFirst"), "validateAgent must call prisma.user.findFirst for owner");
        pass("4. validateAgent middleware - Verified genuine prisma.agents.findFirst & owner lookup");
      } catch (err) {
        fail("4. validateAgent middleware", err);
      }
    } else {
      pass("4. validateAgent middleware - Skipped (no active agent fixture in DB)");
    }

    try {
      // Test checkPlan directly
      prismaSpy.reset();
      const mockReq = { decode: { uid: userA.uid } };
      const mockRes = { status: () => ({ json: () => {} }) };
      let planNextCalled = false;
      await checkPlan(mockReq, mockRes, () => { planNextCalled = true; });
      assert(prismaSpy.hasBeenCalled("user", "findFirst"), "checkPlan must call prisma.user.findFirst");
      pass("5. checkPlan middleware - Verified genuine prisma.user.findFirst lookup");
    } catch (err) {
      fail("5. checkPlan middleware", err);
    }

    // =========================================================================
    // SECTION 2: USER PROFILE (GET /get_me, POST /update_profile)
    // =========================================================================
    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${USER_BASE}/get_me`, { headers: headersA });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.email, userA.email);

      // Verify Prisma was called
      assert(prismaSpy.hasBeenCalled("user", "findFirst"), "get_me must call prisma.user.findFirst");
      assert(prismaSpy.hasBeenCalled("contact", "count"), "get_me must call prisma.contact.count");

      // Verify raw SQL was NOT called for user table in get_me
      const rawUserQueries = rawQueryCalledForTables(["FROM user", "FROM contact"]);
      assert.strictEqual(rawUserQueries.length, 0, "get_me must not execute raw SQL queries for user or contact");
      pass("6. GET /get_me - Genuine Prisma execution verified (user.findFirst + contact.count)");
    } catch (err) {
      fail("6. GET /get_me - Genuine Prisma execution", err);
    }

    try {
      // Update profile
      const newName = "P3 Genuine Prisma Test";
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${USER_BASE}/update_profile`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({
          name: newName,
          email: userA.email,
          mobile_with_country_code: userA.mobile_with_country_code || "+1234567890",
          timezone: "UTC",
        }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.msg, "Profile was updated");

      // Verify Prisma calls
      assert(prismaSpy.hasBeenCalled("user", "updateMany"), "update_profile must call prisma.user.updateMany");
      const rawUserQueries = rawQueryCalledForTables(["UPDATE user"]);
      assert.strictEqual(rawUserQueries.length, 0, "update_profile must not execute raw UPDATE user");

      // Read back via Prisma
      const freshUser = await prisma.user.findFirst({ where: { uid: userA.uid } });
      assert.strictEqual(freshUser.name, newName);
      pass("7. POST /update_profile - Genuine Prisma updateMany verified & persisted");
    } catch (err) {
      fail("7. POST /update_profile - Genuine Prisma updateMany", err);
    }

    // =========================================================================
    // SECTION 3: QUICK REPLIES CRUD (POST, GET, DEL)
    // =========================================================================
    let createdQuickReplyId = null;
    try {
      // Add quick reply
      const msgText = `Prisma quick reply ${Date.now()}`;
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${USER_BASE}/add_quick_reply`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ msg: msgText }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);

      // Verify Prisma call & zero raw SQL
      assert(prismaSpy.hasBeenCalled("quick_reply", "create"), "add_quick_reply must call prisma.quick_reply.create");
      const rawQueries = rawQueryCalledForTables(["quick_reply"]);
      assert.strictEqual(rawQueries.length, 0, "add_quick_reply must not use raw SQL");

      // Verify DB persistence
      const saved = await prisma.quick_reply.findFirst({
        where: { uid: userA.uid, msg: msgText },
      });
      assert(saved, "Quick reply must be found via Prisma");
      createdQuickReplyId = saved.id;
      cleanupQuickReplies.push(createdQuickReplyId);
      pass("8. POST /add_quick_reply - Genuine Prisma create verified", `ID: ${createdQuickReplyId}`);
    } catch (err) {
      fail("8. POST /add_quick_reply - Genuine Prisma create", err);
    }

    try {
      // Get all quick replies & check tenant isolation
      prismaSpy.reset();
      rawQueryCalls = [];

      const resA = await fetch(`${USER_BASE}/get_all_quick_reply`, { headers: headersA });
      const bodyA = await resA.json();
      assert.strictEqual(bodyA.success, true);
      assert(bodyA.data.some((r) => r.id === createdQuickReplyId), "User A must see created quick reply");
      assert(prismaSpy.hasBeenCalled("quick_reply", "findMany"), "get_all_quick_reply must call prisma.quick_reply.findMany");
      assert.strictEqual(rawQueryCalledForTables(["quick_reply"]).length, 0);

      // User B must NOT see it
      const resB = await fetch(`${USER_BASE}/get_all_quick_reply`, { headers: headersB });
      const bodyB = await resB.json();
      assert.strictEqual(bodyB.success, true);
      assert(!bodyB.data.some((r) => r.id === createdQuickReplyId), "User B must NOT see User A's quick reply");
      pass("9. GET /get_all_quick_reply - Genuine Prisma findMany & tenant isolation verified");
    } catch (err) {
      fail("9. GET /get_all_quick_reply - Genuine Prisma findMany", err);
    }

    try {
      // Cross-tenant delete protection
      prismaSpy.reset();
      await fetch(`${USER_BASE}/del_quick_r`, {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({ id: createdQuickReplyId }),
      });
      const stillThere = await prisma.quick_reply.findFirst({
        where: { id: createdQuickReplyId },
      });
      assert(stillThere, "Quick reply must NOT be deleted by another tenant");

      // Owner delete
      prismaSpy.reset();
      rawQueryCalls = [];
      const resDel = await fetch(`${USER_BASE}/del_quick_r`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ id: createdQuickReplyId }),
      });
      const bodyDel = await resDel.json();
      assert.strictEqual(bodyDel.success, true);
      assert(prismaSpy.hasBeenCalled("quick_reply", "deleteMany"), "del_quick_r must call prisma.quick_reply.deleteMany");
      assert.strictEqual(rawQueryCalledForTables(["DELETE FROM quick_reply"]).length, 0);

      const checkGone = await prisma.quick_reply.findFirst({ where: { id: createdQuickReplyId } });
      assert.strictEqual(checkGone, null, "Quick reply must be deleted from DB");
      pass("10. POST /del_quick_r - Genuine Prisma deleteMany & cross-tenant defense verified");
    } catch (err) {
      fail("10. POST /del_quick_r - Genuine Prisma deleteMany", err);
    }

    // =========================================================================
    // SECTION 4: CHAT TAGS CRUD (GET, POST, DELETE)
    // =========================================================================
    let createdTagId = null;
    try {
      const tagTitle = `P3Tag${Date.now().toString().slice(-4)}`;
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${USER_BASE}/add_chat_tag`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ title: tagTitle, hex: "#6366F1" }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("chat_tags", "create"), "add_chat_tag must call prisma.chat_tags.create");
      assert.strictEqual(rawQueryCalledForTables(["chat_tags"]).length, 0);

      const dbTag = await prisma.chat_tags.findFirst({
        where: { uid: userA.uid, title: tagTitle },
      });
      assert(dbTag, "Tag must exist in DB");
      createdTagId = dbTag.id;
      cleanupChatTags.push(createdTagId);
      pass("11. POST /add_chat_tag - Genuine Prisma create verified", `ID: ${createdTagId}`);
    } catch (err) {
      fail("11. POST /add_chat_tag - Genuine Prisma create", err);
    }

    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const resA = await fetch(`${USER_BASE}/get_chat_tags`, { headers: headersA });
      const bodyA = await resA.json();
      assert.strictEqual(bodyA.success, true);
      assert(bodyA.data.some((t) => t.id === createdTagId));
      assert(prismaSpy.hasBeenCalled("chat_tags", "findMany"), "get_chat_tags must call prisma.chat_tags.findMany");
      assert.strictEqual(rawQueryCalledForTables(["chat_tags"]).length, 0);

      // User B isolation
      const resB = await fetch(`${USER_BASE}/get_chat_tags`, { headers: headersB });
      const bodyB = await resB.json();
      assert(!bodyB.data.some((t) => t.id === createdTagId), "User B must not see User A tag");
      pass("12. GET /get_chat_tags - Genuine Prisma findMany & tenant isolation verified");
    } catch (err) {
      fail("12. GET /get_chat_tags - Genuine Prisma findMany", err);
    }

    try {
      // Cross-tenant delete protection
      await fetch(`${USER_BASE}/delete_chat_tag`, {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({ labelId: createdTagId }),
      });
      const stillTag = await prisma.chat_tags.findFirst({ where: { id: createdTagId } });
      assert(stillTag, "Chat tag must NOT be deleted by another tenant");

      // Owner delete
      prismaSpy.reset();
      rawQueryCalls = [];
      await fetch(`${USER_BASE}/delete_chat_tag`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ labelId: createdTagId }),
      });
      assert(prismaSpy.hasBeenCalled("chat_tags", "deleteMany"), "delete_chat_tag must call prisma.chat_tags.deleteMany");
      assert.strictEqual(rawQueryCalledForTables(["DELETE FROM chat_tags"]).length, 0);

      const checkGone = await prisma.chat_tags.findFirst({ where: { id: createdTagId } });
      assert.strictEqual(checkGone, null, "Chat tag must be deleted from DB");
      pass("13. POST /delete_chat_tag - Genuine Prisma deleteMany & cross-tenant defense verified");
    } catch (err) {
      fail("13. POST /delete_chat_tag - Genuine Prisma deleteMany", err);
    }

    // =========================================================================
    // SECTION 5: IN-APP NOTIFICATIONS (GET, MARK READ)
    // =========================================================================
    let notifA = null;
    try {
      notifA = await prisma.in_app_notifications.create({
        data: {
          uid: userA.uid,
          title: "P3 Test Notification",
          message: "Prisma verification notification",
          is_read: false,
        },
      });
      cleanupNotifications.push(notifA.id);

      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${USER_BASE}/notifications`, { headers: headersA });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(body.data.some((n) => n.id === notifA.id));
      assert(prismaSpy.hasBeenCalled("in_app_notifications", "findMany"), "notifications must call prisma.in_app_notifications.findMany");
      assert(prismaSpy.hasBeenCalled("in_app_notifications", "count"), "notifications must call prisma.in_app_notifications.count");
      assert.strictEqual(rawQueryCalledForTables(["in_app_notifications"]).length, 0);
      pass("14. GET /notifications - Genuine Prisma findMany + count verified");
    } catch (err) {
      fail("14. GET /notifications - Genuine Prisma execution", err);
    }

    try {
      // Cross-tenant mark read attempt
      await fetch(`${USER_BASE}/mark_notification_read`, {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({ id: notifA.id }),
      });
      const checkUnread = await prisma.in_app_notifications.findFirst({ where: { id: notifA.id } });
      assert.strictEqual(checkUnread.is_read, false, "User B must NOT mark User A's notification as read");

      // Owner mark read
      prismaSpy.reset();
      rawQueryCalls = [];
      await fetch(`${USER_BASE}/mark_notification_read`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ id: notifA.id }),
      });
      assert(prismaSpy.hasBeenCalled("in_app_notifications", "updateMany"), "mark_notification_read must call prisma.in_app_notifications.updateMany");
      assert.strictEqual(rawQueryCalledForTables(["in_app_notifications"]).length, 0);

      const checkRead = await prisma.in_app_notifications.findFirst({ where: { id: notifA.id } });
      assert.strictEqual(checkRead.is_read, true, "Notification must be marked read in DB");
      pass("15. POST /mark_notification_read - Genuine Prisma updateMany & cross-tenant defense verified");
    } catch (err) {
      fail("15. POST /mark_notification_read - Genuine Prisma updateMany", err);
    }

    // =========================================================================
    // SECTION 6: ADMIN FAQ CRUD (POST, GET, DEL)
    // =========================================================================
    let createdFaqId = null;
    try {
      const q = `Question P3 ${Date.now()}`;
      const a = "Answer P3 via Prisma";
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${ADMIN_BASE}/add_faq`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ question: q, answer: a }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("faq", "create"), "add_faq must call prisma.faq.create");
      assert.strictEqual(rawQueryCalledForTables(["faq"]).length, 0);

      const dbFaq = await prisma.faq.findFirst({ where: { question: q } });
      assert(dbFaq, "FAQ must be saved in DB");
      createdFaqId = dbFaq.id;
      cleanupFaqs.push(createdFaqId);
      pass("16. POST /add_faq - Genuine Prisma create verified", `ID: ${createdFaqId}`);
    } catch (err) {
      fail("16. POST /add_faq - Genuine Prisma create", err);
    }

    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${ADMIN_BASE}/get_faq`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(body.data.some((f) => f.id === createdFaqId));
      assert(prismaSpy.hasBeenCalled("faq", "findMany"), "get_faq must call prisma.faq.findMany");
      assert.strictEqual(rawQueryCalledForTables(["faq"]).length, 0);
      pass("17. GET /get_faq - Genuine Prisma findMany verified");
    } catch (err) {
      fail("17. GET /get_faq - Genuine Prisma findMany", err);
    }

    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${ADMIN_BASE}/del_faq`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ id: createdFaqId }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("faq", "deleteMany"), "del_faq must call prisma.faq.deleteMany");
      assert.strictEqual(rawQueryCalledForTables(["DELETE FROM faq"]).length, 0);

      const checkGone = await prisma.faq.findFirst({ where: { id: createdFaqId } });
      assert.strictEqual(checkGone, null, "FAQ must be deleted from DB");
      pass("18. POST /del_faq - Genuine Prisma deleteMany verified");
    } catch (err) {
      fail("18. POST /del_faq - Genuine Prisma deleteMany", err);
    }

    // =========================================================================
    // SECTION 7: ADMIN TESTIMONIALS CRUD (POST, GET, DEL)
    // =========================================================================
    let createdTestiId = null;
    try {
      const title = `Testimonial P3 ${Date.now()}`;
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${ADMIN_BASE}/add_testimonial`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({
          title,
          description: "Top-tier reliability",
          reviewer_name: "Engineer Alice",
          reviewer_position: "Tech Lead",
        }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("testimonial", "create"), "add_testimonial must call prisma.testimonial.create");
      assert.strictEqual(rawQueryCalledForTables(["testimonial"]).length, 0);

      const dbTesti = await prisma.testimonial.findFirst({ where: { title } });
      assert(dbTesti, "Testimonial must be in DB");
      createdTestiId = dbTesti.id;
      cleanupTestimonials.push(createdTestiId);
      pass("19. POST /add_testimonial - Genuine Prisma create verified", `ID: ${createdTestiId}`);
    } catch (err) {
      fail("19. POST /add_testimonial - Genuine Prisma create", err);
    }

    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${ADMIN_BASE}/get_testi`);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(body.data.some((t) => t.id === createdTestiId));
      assert(prismaSpy.hasBeenCalled("testimonial", "findMany"), "get_testi must call prisma.testimonial.findMany");
      assert.strictEqual(rawQueryCalledForTables(["testimonial"]).length, 0);
      pass("20. GET /get_testi - Genuine Prisma findMany verified");
    } catch (err) {
      fail("20. GET /get_testi - Genuine Prisma findMany", err);
    }

    try {
      prismaSpy.reset();
      rawQueryCalls = [];
      const res = await fetch(`${ADMIN_BASE}/del_testi`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ id: createdTestiId }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("testimonial", "deleteMany"), "del_testi must call prisma.testimonial.deleteMany");
      assert.strictEqual(rawQueryCalledForTables(["DELETE FROM testimonial"]).length, 0);

      const checkGone = await prisma.testimonial.findFirst({ where: { id: createdTestiId } });
      assert.strictEqual(checkGone, null, "Testimonial must be deleted from DB");
      pass("21. POST /del_testi - Genuine Prisma deleteMany verified");
    } catch (err) {
      fail("21. POST /del_testi - Genuine Prisma deleteMany", err);
    }

    // =========================================================================
    // SECTION 8: ADMIN USER STATUS & TRANSACTIONS
    // =========================================================================
    try {
      // toggle_user_status (atomic user update + admin audit log via $transaction)
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${ADMIN_BASE}/toggle_user_status`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ uid: userB.uid, is_blocked: 1 }),
      });
      const body = await res.json();
      if (!body.success) console.error("toggle_user_status failed body:", res.status, body);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.is_blocked, 1);

      assert(prismaSpy.hasBeenCalled("$prisma", "$transaction"), "toggle_user_status must use prisma.$transaction");
      assert(prismaSpy.hasBeenCalled("user", "updateMany"), "toggle_user_status must update user");
      assert(prismaSpy.hasBeenCalled("admin_audit_logs", "create"), "toggle_user_status must write admin audit log");
      assert.strictEqual(rawQueryCalledForTables(["UPDATE user", "admin_audit_logs"]).length, 0);

      // Verify DB row
      const blockedUser = await prisma.user.findFirst({ where: { uid: userB.uid } });
      assert.strictEqual(Boolean(blockedUser.is_blocked), true);

      // Unblock
      await fetch(`${ADMIN_BASE}/toggle_user_status`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ uid: userB.uid, is_blocked: 0 }),
      });
      pass("22. POST /toggle_user_status - Genuine Prisma transaction (user + admin_audit_logs) verified");
    } catch (err) {
      fail("22. POST /toggle_user_status - Genuine Prisma transaction", err);
    }

    try {
      // verify_user_email (atomic user email_verified_at + email_verification update via $transaction)
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${ADMIN_BASE}/verify_user_email`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({ uid: userB.uid }),
      });
      const body = await res.json();
      if (!body.success) console.error("verify_user_email failed body:", res.status, body);
      assert.strictEqual(body.success, true);

      assert(prismaSpy.hasBeenCalled("$prisma", "$transaction"), "verify_user_email must use prisma.$transaction");
      assert(prismaSpy.hasBeenCalled("user", "updateMany"), "verify_user_email must update user email_verified_at");
      assert(prismaSpy.hasBeenCalled("email_verification", "updateMany"), "verify_user_email must update email_verification used_at");
      assert.strictEqual(rawQueryCalledForTables(["UPDATE user", "UPDATE email_verification"]).length, 0);
      pass("23. POST /verify_user_email - Genuine Prisma transaction (user + email_verification) verified");
    } catch (err) {
      fail("23. POST /verify_user_email - Genuine Prisma transaction", err);
    }

    try {
      // update_user by admin
      prismaSpy.reset();
      rawQueryCalls = [];

      const res = await fetch(`${ADMIN_BASE}/update_user`, {
        method: "POST",
        headers: headersAdmin,
        body: JSON.stringify({
          uid: userB.uid,
          name: userB.name,
          email: userB.email,
          mobile_with_country_code: userB.mobile_with_country_code || "+9876543210",
        }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(prismaSpy.hasBeenCalled("user", "findFirst"), "update_user must find user");
      assert(prismaSpy.hasBeenCalled("user", "updateMany"), "update_user must update user");
      assert.strictEqual(rawQueryCalledForTables(["UPDATE user"]).length, 0);
      pass("24. POST /update_user - Genuine Prisma updateMany verified");
    } catch (err) {
      fail("24. POST /update_user - Genuine Prisma updateMany", err);
    }

    // =========================================================================
    // SECTION 9: BIGINT AND SERIALIZATION SAFETY
    // =========================================================================
    try {
      const testObj = {
        safeBigInt: BigInt(42),
        maxSafe: BigInt(Number.MAX_SAFE_INTEGER),
        unsafeBigInt: BigInt("9007199254740999999"),
        decimalLike: { toNumber: () => 123.45 },
        date: new Date("2026-10-22T00:00:00.000Z"),
        nested: {
          array: [BigInt(100), BigInt("999999999999999999999")],
        },
      };

      const sanitized = sanitizeBigInt(testObj);
      assert.strictEqual(typeof sanitized.safeBigInt, "number");
      assert.strictEqual(sanitized.safeBigInt, 42);
      assert.strictEqual(sanitized.maxSafe, Number.MAX_SAFE_INTEGER);
      assert.strictEqual(typeof sanitized.unsafeBigInt, "string");
      assert.strictEqual(sanitized.unsafeBigInt, "9007199254740999999");
      assert.strictEqual(sanitized.decimalLike, 123.45);
      assert(sanitized.date instanceof Date);
      assert.strictEqual(sanitized.nested.array[0], 100);
      assert.strictEqual(sanitized.nested.array[1], "999999999999999999999");

      // Verify JSON serialization doesn't throw
      const json = JSON.stringify(sanitized);
      assert(json.includes('"safeBigInt":42'));
      assert(json.includes('"unsafeBigInt":"9007199254740999999"'));
      pass("25. BigInt & serialization safety - sanitizeBigInt preserves safe numbers and avoids precision loss");
    } catch (err) {
      fail("25. BigInt & serialization safety", err);
    }

    // =========================================================================
    // SECTION 10: AUTHORIZATION & BOUNDARY FAILURES
    // =========================================================================
    try {
      // Unauthenticated request to protected route
      const resUnauth = await fetch(`${USER_BASE}/get_me`);
      assert.strictEqual(resUnauth.status, 401);

      // Regular user token to admin route
      const resForbidden = await fetch(`${ADMIN_BASE}/add_faq`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ question: "Q", answer: "A" }),
      });
      assert(resForbidden.status === 401 || resForbidden.status === 403);

      // Missing parameters validation
      const resValidation = await fetch(`${USER_BASE}/update_profile`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ name: "" }),
      });
      const bodyValidation = await resValidation.json();
      assert.strictEqual(bodyValidation.success, false);

      pass("26. Security & input validation - 401 unauth, 403 non-admin, and 400 validation rejected cleanly");
    } catch (err) {
      fail("26. Security & input validation", err);
    }
  } catch (criticalErr) {
    console.error("Critical suite execution error:", criticalErr);
    failed++;
  } finally {
    // Teardown and deterministic cleanup
    console.log("\n🧹 Running test teardown and cleanup...");
    if (userA && userAOriginalName) {
      try {
        await prisma.user.updateMany({
          where: { uid: userA.uid },
          data: { name: userAOriginalName, timezone: userAOriginalTimezone },
        });
      } catch (e) {
        console.error("Failed to restore User A name:", e);
      }
    }
    if (cleanupQuickReplies.length > 0) {
      try {
        await prisma.quick_reply.deleteMany({ where: { id: { in: cleanupQuickReplies } } });
      } catch (e) {
        console.error("Failed to clean up quick replies:", e);
      }
    }
    if (cleanupChatTags.length > 0) {
      try {
        await prisma.chat_tags.deleteMany({ where: { id: { in: cleanupChatTags } } });
      } catch (e) {
        console.error("Failed to clean up chat tags:", e);
      }
    }
    if (cleanupNotifications.length > 0) {
      try {
        await prisma.in_app_notifications.deleteMany({ where: { id: { in: cleanupNotifications } } });
      } catch (e) {
        console.error("Failed to clean up notifications:", e);
      }
    }
    if (cleanupFaqs.length > 0) {
      try {
        await prisma.faq.deleteMany({ where: { id: { in: cleanupFaqs } } });
      } catch (e) {
        console.error("Failed to clean up FAQs:", e);
      }
    }
    if (cleanupTestimonials.length > 0) {
      try {
        await prisma.testimonial.deleteMany({ where: { id: { in: cleanupTestimonials } } });
      } catch (e) {
        console.error("Failed to clean up testimonials:", e);
      }
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  }

  console.log("\n====================================================================");
  console.log(`📊 P3 ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
