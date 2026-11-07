// Behavioural tests for CLAUDE audit fixes (web.js, qr.js, billing.js, razorpay, entitlements).
// Runs the REAL route modules against an in-memory Prisma stub (no MySQL needed).
// Usage (from backend/): node test-audit-fixes-unit.js   — no DB or server needed
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");

const BACKEND = path.resolve(process.argv[2] || __dirname);
process.env.JWTKEY = "test_jwt_key";
process.env.API_RATE_LIMIT_ENABLED = "false";
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;
delete process.env.RAZORPAY_MOCK;

const Module = require("module");
const backendRequire = Module.createRequire(path.join(BACKEND, "index.js"));
const express = backendRequire("express");

// ---------------- in-memory prisma ----------------
const db = {};
function table(name) {
  if (!db[name]) db[name] = [];
  return db[name];
}
let autoId = 1000;

function matchValue(actual, cond) {
  if (cond === null) return actual === null || actual === undefined;
  if (cond && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond) return cond.in.includes(actual);
    if ("notIn" in cond) return actual !== null && actual !== undefined && !cond.notIn.includes(actual);
    if ("not" in cond) return cond.not === null ? actual != null : actual !== cond.not;
    if ("contains" in cond) return actual != null && String(actual).includes(cond.contains);
    if ("lt" in cond) return actual < cond.lt;
    throw new Error("unsupported cond " + JSON.stringify(cond));
  }
  return actual === cond;
}
function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    if (k === "AND") { if (!v.every((w) => matches(row, w))) return false; continue; }
    if (k === "NOT") { if (matches(row, v)) return false; continue; }
    if (!matchValue(row[k], v)) return false;
  }
  return true;
}
function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
    else row[k] = v;
  }
}
function pick(row, select) {
  if (!row || !select) return row ? { ...row } : row;
  const o = {};
  for (const k of Object.keys(select)) o[k] = row[k];
  return o;
}
function model(name) {
  return {
    findFirst: async ({ where, select, orderBy } = {}) => {
      let rows = table(name).filter((r) => matches(r, where));
      if (orderBy?.id === "desc") rows = [...rows].reverse();
      return pick(rows[0] || null, select);
    },
    findUnique: async ({ where, select } = {}) => pick(table(name).find((r) => matches(r, where)) || null, select),
    findMany: async ({ where, select, take, skip = 0 } = {}) =>
      table(name).filter((r) => matches(r, where)).slice(skip, take ? skip + take : undefined).map((r) => pick(r, select)),
    count: async ({ where } = {}) => table(name).filter((r) => matches(r, where)).length,
    create: async ({ data }) => {
      if (name === "processed_webhook_events" && table(name).some((r) => r.event_id === data.event_id)) {
        const e = new Error("Unique constraint failed"); e.code = "P2002"; throw e;
      }
      const row = { id: ++autoId, ...data };
      table(name).push(row);
      return { ...row };
    },
    createMany: async ({ data }) => { for (const d of data) table(name).push({ id: ++autoId, ...d }); return { count: data.length }; },
    update: async ({ where, data }) => { const r = table(name).find((x) => matches(x, where)); applyData(r, data); return { ...r }; },
    updateMany: async ({ where, data }) => {
      const rows = table(name).filter((r) => matches(r, where));
      rows.forEach((r) => applyData(r, data));
      return { count: rows.length };
    },
    deleteMany: async ({ where }) => {
      const before = table(name).length;
      db[name] = table(name).filter((r) => !matches(r, where));
      return { count: before - db[name].length };
    },
    upsert: async () => ({}),
  };
}
const prisma = new Proxy({}, {
  get(_, prop) {
    if (prop === "$transaction") return async (fn) => fn(prisma);
    if (typeof prop === "symbol" || prop === "then") return undefined;
    return model(prop);
  },
});

// ---------------- module stubs ----------------
function stub(rel, exportsObj) {
  const file = backendRequire.resolve(path.join(BACKEND, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}
const sessions = new Map();
const logoutCalls = [];
stub("database/prisma.js", { prisma, PrismaClient: function () {} });
stub("database/dbpromise.js", { query: async () => { if (process.env.BASELINE) return []; throw new Error("raw SQL must not be used in converted code"); } });
stub("middlewares/user.js", (req, res, next) => {
  const uid = req.get("x-test-uid");
  if (!uid) return res.status(401).json({ success: false });
  req.decode = { uid, role: "user" };
  next();
});
stub("middlewares/admin.js", (req, res, next) => {
  if (req.get("x-test-admin") !== "1") return res.status(401).json({ success: false, msg: "admin required" });
  req.decode = { uid: "admin1", role: "admin" };
  next();
});
stub("middlewares/agent.js", (req, res, next) => next());
stub("middlewares/plan.js", {
  checkQrScan: (req, res, next) => next(),
  checkPlan: (req, res, next) => {
    const u = table("user").find((x) => x.uid === req.decode.uid);
    req.plan = JSON.parse(u.plan);
    next();
  },
});
stub("middlewares/rateLimiter.js", { authRateLimiter: () => (req, res, next) => next() });
stub("middlewares/license.js", { checkLicense: (req, res, next) => next(), createLicenseFile: () => {} });
stub("socket.js", { getAllSocketData: () => [] });
stub("utils/addons.js", { returnAddons: () => [] });
stub("helper/addon/embed/index.js", { checkEmbed: () => {}, genEmbedWebhook: async () => "wh" });
stub("helper/addon/insta/insta.js", { genInstaWebhook: async () => "iwh", getInstaCallbackUri: async () => "cb" });
stub("helper/addon/qr/index.js", {
  createSession: async (id) => { sessions.set(id, { logout: async () => logoutCalls.push(id) }); },
  sendMessage: async () => {},
  getSession: (id) => sessions.get(id),
  deleteSession: (id) => sessions.delete(id),
  cancelPendingSession: async () => {},
  isExists: async () => true,
  checkQr: () => {},
  generateProfilePicture: () => {},
});

// ---------------- app ----------------
const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use("/api/web", backendRequire(path.join(BACKEND, "routes/web.js")));
app.use("/api/qr", backendRequire(path.join(BACKEND, "routes/qr.js")));
app.use("/api/billing", backendRequire(path.join(BACKEND, "routes/billing.js")));
const razorpay = backendRequire(path.join(BACKEND, "helper/razorpay.js"));

let base;
async function call(method, url, { uid, admin, body, headers = {}, raw } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (uid) h["x-test-uid"] = uid;
  if (admin) h["x-test-admin"] = "1";
  const res = await fetch(base + url, { method, headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const DAY = 86400000;
function reset() {
  for (const k of Object.keys(db)) delete db[k];
  sessions.clear();
  logoutCalls.length = 0;
  table("web_private").push({ id: 1, rz_id: null, rz_key: null, rz_webhook_secret: null, mongodb_string: "mongodb://secret", pay_paypal_key: "pp_secret" });
  table("web_public").push({ id: 1, app_name: "Resend", fb_login_app_sec: "fbsec" });
  table("plan").push(
    { id: 1, title: "Free Trial", is_trial: 1, price: 0, plan_duration_in_days: 14, qr_account: 1, contact_limit: 10 },
    { id: 2, title: "Pro", is_trial: 0, price: 10, plan_duration_in_days: 30, qr_account: 1, contact_limit: 3, rest_api_qr: 1 },
  );
}
function addUser(uid, { plan = 2, expire = Date.now() + 10 * DAY, trial = 0 } = {}) {
  const p = table("plan").find((x) => x.id === plan);
  table("user").push({ uid, plan: JSON.stringify(p), plan_expire: String(expire), trial, subscription_status: trial ? "trialing" : "active" });
}
function configureRazorpay() {
  Object.assign(table("web_private")[0], { rz_id: "rzp_live_x", rz_key: "real_secret", rz_webhook_secret: "wh_secret" });
}
const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

const results = [];
async function test(name, fn) {
  reset();
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, e.message]); }
}

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  // ---------- web.js ----------
  await test("SEC-01 get_web_pvt rejects non-admin", async () => {
    const r = await call("GET", "/api/web/get_web_pvt");
    assert.strictEqual(r.status, 401);
    assert(!JSON.stringify(r.json).includes("mongodb://secret"));
  });
  await test("SEC-01 get_web_pvt works for admin (Prisma)", async () => {
    const r = await call("GET", "/api/web/get_web_pvt", { admin: true });
    assert.strictEqual(r.json.success, true);
    assert.strictEqual(r.json.data.mongodb_string, "mongodb://secret");
  });
  await test("get_web_public strips fb secret (Prisma)", async () => {
    const r = await call("GET", "/api/web/get_web_public");
    assert.strictEqual(r.json.data.app_name, "Resend");
    assert.strictEqual(r.json.data.fb_login_app_sec, undefined);
  });
  await test("MED-07 install_app / update_app require admin", async () => {
    assert.strictEqual((await call("POST", "/api/web/install_app")).status, 401);
    assert.strictEqual((await call("POST", "/api/web/update_app", { body: { password: "x" } })).status, 401);
  });
  await test("SEC-09 exchange-token requires login and has no hard-coded secret", async () => {
    assert.strictEqual((await call("POST", "/api/web/exchange-token", { body: { code: "c" } })).status, 401);
    const r = await call("POST", "/api/web/exchange-token", { uid: "u1", body: { code: "c" } });
    assert.strictEqual(r.status, 503);
  });

  // ---------- qr.js ----------
  await test("SEC-08 /api/qr/create and /api/qr/send removed", async () => {
    assert.strictEqual((await call("GET", "/api/qr/create?id=x")).status, 404);
    assert.strictEqual((await call("GET", "/api/qr/send")).status, 404);
  });
  await test("QR-01 del_instance cannot log out another tenant's session", async () => {
    table("instance").push({ id: 1, uid: "victim", uniqueId: "victim_abc", status: "ACTIVE" });
    sessions.set("victim_abc", { logout: async () => logoutCalls.push("victim_abc") });
    const r = await call("POST", "/api/qr/del_instance", { uid: "attacker", body: { uniqueId: "victim_abc" } });
    assert.strictEqual(r.status, 404);
    assert.strictEqual(logoutCalls.length, 0);
    assert(sessions.has("victim_abc"));
    assert.strictEqual(table("instance").length, 1);
  });
  await test("QR-01 logout_instance / change_instance_status / get_profile_pic check ownership", async () => {
    table("instance").push({ id: 1, uid: "victim", uniqueId: "victim_abc", status: "ACTIVE" });
    sessions.set("victim_abc", { logout: async () => logoutCalls.push("victim_abc"), sendPresenceUpdate: async () => {} });
    assert.strictEqual((await call("POST", "/api/qr/logout_instance", { uid: "attacker", body: { uniqueId: "victim_abc" } })).status, 404);
    assert.strictEqual((await call("POST", "/api/qr/change_instance_status", { uid: "attacker", body: { insId: "victim_abc", status: "available" } })).status, 404);
    const pp = await call("GET", "/api/qr/get_profile_pic?uniqueId=victim_abc", { uid: "attacker" });
    assert.strictEqual(pp.json.success, false);
    assert.strictEqual(logoutCalls.length, 0);
  });
  await test("QR-01 owner can still delete own instance", async () => {
    table("instance").push({ id: 1, uid: "u1", uniqueId: "u1_abc", status: "ACTIVE" });
    sessions.set("u1_abc", { logout: async () => logoutCalls.push("u1_abc") });
    const r = await call("POST", "/api/qr/del_instance", { uid: "u1", body: { uniqueId: "u1_abc" } });
    assert.strictEqual(r.json.success, true);
    assert.deepStrictEqual(logoutCalls, ["u1_abc"]);
    assert.strictEqual(table("instance").length, 0);
  });
  await test("QR-02 gen_qr rejects ids not prefixed with own uid", async () => {
    addUser("u1");
    const r = await call("POST", "/api/qr/gen_qr", { uid: "u1", body: { title: "t", uniqueId: "victim_abc" } });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(table("instance").length, 0);
  });
  await test("QR-02 gen_qr accepts frontend id format and creates instance", async () => {
    addUser("u1");
    const r = await call("POST", "/api/qr/gen_qr", { uid: "u1", body: { title: "t", uniqueId: "u1_lz3k9a" } });
    assert.strictEqual(r.json.success, true, JSON.stringify(r.json));
    assert.strictEqual(table("instance")[0].status, "PENDING");
  });
  await test("QR-03 reconnect cannot exceed qr limit", async () => {
    addUser("u1"); // Pro: qr_account = 1
    table("instance").push(
      { id: 1, uid: "u1", uniqueId: "u1_a", status: "ACTIVE" },
      { id: 2, uid: "u1", uniqueId: "u1_b", status: "INACTIVE" },
    );
    const r = await call("POST", "/api/qr/reconnect_instance", { uid: "u1", body: { uniqueId: "u1_b" } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.json.code, "PLAN_LIMIT_REACHED");
  });
  await test("QR-03 re-scanning own ACTIVE instance at limit is allowed", async () => {
    addUser("u1");
    table("instance").push({ id: 1, uid: "u1", uniqueId: "u1_a", status: "ACTIVE" });
    const r = await call("POST", "/api/qr/reconnect_instance", { uid: "u1", body: { uniqueId: "u1_a" } });
    assert.strictEqual(r.json.success, true, JSON.stringify(r.json));
  });
  await test("LIM-01 import_wa_contacts enforces batch vs contact limit and phonebook owner", async () => {
    addUser("u1"); // contact_limit 3
    table("phonebook").push({ id: 5, uid: "u1", name: "PB" }, { id: 6, uid: "other", name: "X" });
    const contacts = [1, 2, 3, 4].map((n) => ({ name: "c" + n, mobile: "9100000000" + n }));
    let r = await call("POST", "/api/qr/import_wa_contacts", { uid: "u1", body: { contacts, phonebook_id: 5 } });
    assert.strictEqual(r.status, 403);
    r = await call("POST", "/api/qr/import_wa_contacts", { uid: "u1", body: { contacts: contacts.slice(0, 2), phonebook_id: 6 } });
    assert.strictEqual(r.status, 404);
    r = await call("POST", "/api/qr/import_wa_contacts", { uid: "u1", body: { contacts: contacts.slice(0, 3), phonebook_id: 5 } });
    assert.strictEqual(r.json.inserted, 3);
  });
  await test("QR-04 REST API requires rest_api_qr (not wa_warmer)", async () => {
    const jwt = backendRequire("jsonwebtoken");
    const token = jwt.sign({ uid: "u1", role: "user" }, process.env.JWTKEY);
    addUser("u1", { plan: 1 }); // trial plan: no rest_api_qr
    table("user")[0].api_key = token;
    let r = await call("POST", "/api/qr/rest/send_message", { body: { messageType: "text", requestType: "post", token, from: "+911", to: "912", text: "hi" } });
    assert.strictEqual(r.status, 403);
    table("user")[0].plan = JSON.stringify(table("plan")[1]); // Pro has rest_api_qr
    r = await call("POST", "/api/qr/rest/send_message", { body: { messageType: "text", requestType: "post", token, from: "+911", to: "912", text: "hi" } });
    assert.strictEqual(r.status, 404); // passes entitlement, fails on missing instance
  });

  // ---------- razorpay ----------
  await test("SEC-06 no fallback secrets; unconfigured gateway refuses orders", async () => {
    const cfg = await razorpay.getRazorpayConfig();
    assert.strictEqual(cfg.keySecret, null);
    assert.strictEqual(cfg.webhookSecret, null);
    await assert.rejects(() => razorpay.createRazorpayOrder({ amountMinor: 1000, receipt: "r" }), /not configured/);
  });
  await test("SEC-06 mock HMAC with public dev secret is rejected when mock mode is off", async () => {
    const ok = await razorpay.verifyRazorpaySignature({
      orderId: "order_mock_1", paymentId: "pay_1",
      signature: hmac("rzp_test_mock_key_secret", "order_mock_1|pay_1"),
    });
    assert.strictEqual(ok, false);
    const ok2 = await razorpay.verifyRazorpaySignature({ orderId: "order_mock_1", paymentId: "pay_1", signature: "mock_signature_dev_test" });
    assert.strictEqual(ok2, false);
  });
  await test("SEC-06 forged webhook with old default secret rejected", async () => {
    addUser("u1");
    table("orders").push({ id: 1, uid: "u1", s_token: "order_X", status: "created", data: JSON.stringify({ plan: { id: 2 }, totalDays: 30 }) });
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_X" } } } });
    const r = await call("POST", "/api/billing/webhook", { raw, headers: { "x-razorpay-signature": hmac("wacrm_rz_webhook_secret", raw) } });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(table("orders")[0].status, "created");
  });
  await test("SEC-06 mock mode works only with RAZORPAY_MOCK=1 outside production", async () => {
    process.env.RAZORPAY_MOCK = "1";
    try {
      const o = await razorpay.createRazorpayOrder({ amountMinor: 1000, receipt: "r" });
      assert(o.isMock);
      assert(await razorpay.verifyRazorpaySignature({ orderId: o.id, paymentId: "p", signature: hmac("rzp_test_mock_key_secret", `${o.id}|p`) }));
      process.env.NODE_ENV = "production";
      assert.strictEqual(await razorpay.verifyRazorpaySignature({ orderId: o.id, paymentId: "p", signature: hmac("rzp_test_mock_key_secret", `${o.id}|p`) }), false);
    } finally { delete process.env.RAZORPAY_MOCK; delete process.env.NODE_ENV; }
  });
  await test("create_order returns 503 when gateway not configured", async () => {
    addUser("u1");
    const r = await call("POST", "/api/billing/create_order", { uid: "u1", body: { planId: 2 } });
    assert.strictEqual(r.status, 503);
  });
  await test("PAY-02 coupon rejected on autopay", async () => {
    addUser("u1");
    const r = await call("POST", "/api/billing/create_order", { uid: "u1", body: { planId: 2, autopay: true, couponCode: "X" } });
    assert.strictEqual(r.status, 400);
  });

  // ---------- billing: payment idempotency ----------
  await test("PAY-01 parallel verify_payment credits the plan once", async () => {
    configureRazorpay();
    addUser("u1", { expire: Date.now() + 5 * DAY });
    table("orders").push({ id: 1, uid: "u1", s_token: "order_A", status: "created", payment_mode: "RAZORPAY", data: JSON.stringify({ plan: { id: 2 }, totalDays: 30, couponCode: "SAVE" }) });
    table("coupon").push({ id: 1, code: "SAVE", used_count: 0 });
    const before = Number(table("user")[0].plan_expire);
    const body = { razorpay_order_id: "order_A", razorpay_payment_id: "pay_A", razorpay_signature: hmac("real_secret", "order_A|pay_A") };
    const [a, b] = await Promise.all([
      call("POST", "/api/billing/verify_payment", { uid: "u1", body }),
      call("POST", "/api/billing/verify_payment", { uid: "u1", body }),
    ]);
    assert(a.json.success && b.json.success);
    const days = Math.round((Number(table("user")[0].plan_expire) - before) / DAY);
    assert.strictEqual(days, 30, `extended ${days} days`);
    assert.strictEqual(table("coupon")[0].used_count, 1);
  });
  await test("PAY-01 webhook after verify_payment does not double-credit", async () => {
    configureRazorpay();
    addUser("u1", { expire: Date.now() + 5 * DAY });
    table("orders").push({ id: 1, uid: "u1", s_token: "order_A", status: "created", payment_mode: "RAZORPAY", data: JSON.stringify({ plan: { id: 2 }, totalDays: 30 }) });
    const before = Number(table("user")[0].plan_expire);
    await call("POST", "/api/billing/verify_payment", { uid: "u1", body: { razorpay_order_id: "order_A", razorpay_payment_id: "pay_A", razorpay_signature: hmac("real_secret", "order_A|pay_A") } });
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_A", order_id: "order_A" } } } });
    const sig = hmac("wh_secret", raw);
    const w1 = await call("POST", "/api/billing/webhook", { raw, headers: { "x-razorpay-signature": sig, "x-razorpay-event-id": "evt_1" } });
    const w2 = await call("POST", "/api/billing/webhook", { raw, headers: { "x-razorpay-signature": sig, "x-razorpay-event-id": "evt_1" } });
    assert.strictEqual(w1.json.success, true);
    assert.strictEqual(w2.json.duplicate, true);
    const days = Math.round((Number(table("user")[0].plan_expire) - before) / DAY);
    assert.strictEqual(days, 30, `extended ${days} days`);
  });
  await test("PAY-01 autopay first charge: verify + subscription.charged credit once; renewal credits again", async () => {
    configureRazorpay();
    addUser("u1", { expire: Date.now() + 5 * DAY });
    table("orders").push({ id: 1, uid: "u1", s_token: "sub_A", status: "created", payment_mode: "RAZORPAY_AUTOPAY", data: JSON.stringify({ plan: { id: 2 }, totalDays: 30, isAutopay: true }) });
    const before = Number(table("user")[0].plan_expire);
    await call("POST", "/api/billing/verify_payment", { uid: "u1", body: { razorpay_subscription_id: "sub_A", razorpay_payment_id: "pay_1", razorpay_signature: hmac("real_secret", "pay_1|sub_A") } });
    const send = (payId, evt) => {
      const raw = JSON.stringify({ event: "subscription.charged", payload: { payment: { entity: { id: payId, subscription_id: "sub_A", amount: 1000 } } } });
      return call("POST", "/api/billing/webhook", { raw, headers: { "x-razorpay-signature": hmac("wh_secret", raw), "x-razorpay-event-id": evt } });
    };
    await send("pay_1", "evt_first");
    let days = Math.round((Number(table("user")[0].plan_expire) - before) / DAY);
    assert.strictEqual(days, 30, `after first charge extended ${days}`);
    await send("pay_2", "evt_renew");
    days = Math.round((Number(table("user")[0].plan_expire) - before) / DAY);
    assert.strictEqual(days, 60, `after renewal extended ${days}`);
    assert.strictEqual(table("user")[0].subscription_id, "sub_A");
  });
  await test("Refunded order cannot be re-credited", async () => {
    configureRazorpay();
    addUser("u1");
    table("orders").push({ id: 1, uid: "u1", s_token: "order_R", status: "refunded", payment_mode: "RAZORPAY", data: JSON.stringify({ plan: { id: 2 }, totalDays: 30 }) });
    const r = await call("POST", "/api/billing/verify_payment", { uid: "u1", body: { razorpay_order_id: "order_R", razorpay_payment_id: "p", razorpay_signature: hmac("real_secret", "order_R|p") } });
    assert.strictEqual(r.status, 400);
  });

  // ---------- billing: trial ----------
  await test("ONB-01 activate_trial succeeds idempotently for signup-trialing user", async () => {
    addUser("u1", { plan: 1, trial: 1 });
    const r = await call("POST", "/api/billing/activate_trial", { uid: "u1" });
    assert.strictEqual(r.json.success, true, JSON.stringify(r.json));
    assert.strictEqual(r.json.alreadyActive, true);
  });
  await test("ONB-02 trial cannot be re-taken after a paid plan expires", async () => {
    // signup-style trial grant through updateUserPlan writes the permanent marker
    table("user").push({ uid: "u1" });
    const { updateUserPlan } = backendRequire(path.join(BACKEND, "functions/function.js"));
    await updateUserPlan(table("plan")[0], "u1", 14);
    assert(table("orders").some((o) => o.uid === "u1" && o.payment_mode === "FREE_TRIAL"));
    await updateUserPlan(table("plan")[1], "u1"); // paid plan resets user.trial to 0
    table("user")[0].plan_expire = String(Date.now() - DAY); // paid plan expired
    const r = await call("POST", "/api/billing/activate_trial", { uid: "u1" });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.msg, /already used/);
  });
  await test("MED-10 active (even cancelled) paid plan blocks trial", async () => {
    addUser("u1");
    table("user")[0].subscription_status = "cancelled";
    const r = await call("POST", "/api/billing/activate_trial", { uid: "u1" });
    assert.strictEqual(r.status, 400);
  });
  await test("Fresh user can activate trial exactly once", async () => {
    table("user").push({ uid: "u1", plan: null, plan_expire: null, trial: 0 });
    const r1 = await call("POST", "/api/billing/activate_trial", { uid: "u1" });
    assert.strictEqual(r1.json.success, true, JSON.stringify(r1.json));
    assert.strictEqual(table("orders").filter((o) => o.payment_mode === "FREE_TRIAL").length, 1);
  });

  // ---------- entitlements ----------
  await test("MED-02 plan with < 24h left is still valid", async () => {
    const { resolveUserPlan } = backendRequire(path.join(BACKEND, "helper/entitlements.js"));
    const r = await resolveUserPlan({ plan: JSON.stringify({ id: 2 }), plan_expire: String(Date.now() + 3600000) });
    assert.strictEqual(r.isValid, true);
    const r2 = await resolveUserPlan({ plan: JSON.stringify({ id: 2 }), plan_expire: String(Date.now() - 1000) });
    assert.strictEqual(r2.isExpired, true);
  });

  server.close();
  for (const r of results) console.log(r.join("  "));
  const failed = results.filter((r) => r[0] === "FAIL").length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
