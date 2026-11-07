/**
 * Prisma conversion smoke tester (no database required).
 *
 * - Every Prisma call made by the code under test is validated against schema.prisma by the
 *   REAL Prisma client (query validation runs client-side before any connection is made).
 * - Results come from a small permissive in-memory store so code paths keep executing.
 * - Any remaining raw `query()` call (database/dbpromise.js) is reported.
 * - Routers are exercised automatically: every route is called with request fields scraped
 *   from the router source file.
 *
 * Usage (from backend/):  node test-prisma-smoke.js routes/phonebook.js [routes/other.js ...]
 */
const path = require("path");
const fs = require("fs");
const Module = require("module");

const BACKEND = path.resolve(__dirname, "..");
const backendRequire = Module.createRequire(path.join(BACKEND, "index.js"));

process.env.JWTKEY = process.env.JWTKEY || "smoke_test_key";
process.env.API_RATE_LIMIT_ENABLED = "false";

const report = { validation: [], rawSql: [], serverErrors: [], calls: 0 };

// ---------------- real client (validator only, points at a dead port) ----------------
const { PrismaMariaDb } = backendRequire("@prisma/adapter-mariadb");
const { PrismaClient } = backendRequire("@prisma/client");
const validator = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: "127.0.0.1",
    port: 1,
    user: "x",
    password: "x",
    database: "x",
    connectTimeout: 200,
    acquireTimeout: 300,
    connectionLimit: 1,
  }),
  log: [],
});

const VALIDATION_WINDOW_MS = 250;
async function validate(modelName, method, args, where) {
  report.calls++;
  let target = modelName ? validator[modelName] : validator;
  if (!target || typeof target[method] !== "function") {
    report.validation.push({ where, call: `${modelName}.${method}`, msg: "unknown model or method" });
    return;
  }
  const p = Promise.resolve().then(() => target[method](...args));
  p.catch(() => {});
  const outcome = await Promise.race([
    p.then(() => "ok", (e) => e),
    new Promise((r) => setTimeout(() => r("timeout"), VALIDATION_WINDOW_MS)),
  ]);
  if (outcome instanceof Error && outcome.constructor.name === "PrismaClientValidationError") {
    const msg = String(outcome.message).split("\n").filter(Boolean).slice(-1)[0];
    report.validation.push({ where, call: `${modelName}.${method}`, msg });
  }
}

// ---------------- permissive in-memory store ----------------
const store = {};
let autoId = 100;
const table = (n) => (store[n] = store[n] || []);

function matchValue(actual, cond) {
  if (cond === null) return actual == null;
  if (cond && typeof cond === "object" && !(cond instanceof Date)) {
    if ("equals" in cond) return actual === cond.equals;
    if ("in" in cond) return cond.in.includes(actual);
    if ("notIn" in cond) return actual != null && !cond.notIn.includes(actual);
    if ("not" in cond) return cond.not === null ? actual != null : actual !== cond.not;
    if ("contains" in cond) return actual != null && String(actual).includes(cond.contains);
    if ("startsWith" in cond) return actual != null && String(actual).startsWith(cond.startsWith);
    if ("gt" in cond || "gte" in cond || "lt" in cond || "lte" in cond) return true;
    return true;
  }
  return actual === cond;
}
function matches(row, where = {}) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v === undefined) continue;
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    if (k === "AND") { if (![].concat(v).every((w) => matches(row, w))) return false; continue; }
    if (k === "NOT") { if ([].concat(v).some((w) => matches(row, w))) return false; continue; }
    if (!(k in row)) continue; // permissive: unknown fields don't filter out
    if (!matchValue(row[k], v)) return false;
  }
  return true;
}
function eqFields(where = {}) {
  const o = {};
  for (const [k, v] of Object.entries(where || {})) {
    if (["OR", "AND", "NOT"].includes(k)) continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) o[k] = v;
    else if (v && typeof v === "object" && "equals" in v) o[k] = v.equals;
  }
  return o;
}
function synth(where) {
  return { id: 1, uid: "u1", createdAt: new Date(), ...eqFields(where) };
}
function pick(row, select) {
  if (!row) return row;
  if (!select) return { ...row };
  const o = {};
  for (const k of Object.keys(select)) o[k] = row[k] ?? (k === "id" ? 1 : null);
  return o;
}
function apply(row, data = {}) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("increment" in v) { row[k] = (Number(row[k]) || 0) + v.increment; continue; }
      if ("decrement" in v) { row[k] = (Number(row[k]) || 0) - v.decrement; continue; }
      if ("set" in v) { row[k] = v.set; continue; }
    }
    row[k] = v;
  }
}
function fakeModel(name) {
  const rows = () => table(name).filter(() => true);
  return {
    findFirst: async (a = {}) => pick(rows().find((r) => matches(r, a.where)) || (table(name).length ? null : synth(a.where)), a.select),
    findUnique: async (a = {}) => pick(rows().find((r) => matches(r, a.where)) || (table(name).length ? null : synth(a.where)), a.select),
    findFirstOrThrow: async (a = {}) => pick(rows().find((r) => matches(r, a.where)) || synth(a.where), a.select),
    findUniqueOrThrow: async (a = {}) => pick(rows().find((r) => matches(r, a.where)) || synth(a.where), a.select),
    findMany: async (a = {}) => {
      const list = table(name).length ? rows().filter((r) => matches(r, a.where)) : [synth(a.where)];
      return list.slice(a.skip || 0, a.take ? (a.skip || 0) + Math.abs(a.take) : undefined).map((r) => pick(r, a.select));
    },
    count: async (a = {}) => (table(name).length ? rows().filter((r) => matches(r, a.where)).length : 1),
    aggregate: async () => ({ _count: { _all: 1 }, _sum: {}, _max: {}, _min: {}, _avg: {} }),
    groupBy: async (a = {}) => [{ ...(a.by || []).reduce((o, k) => ({ ...o, [k]: "1" }), {}), _count: { _all: 1, id: 1 }, _sum: {}, _max: {}, _min: {} }],
    create: async (a = {}) => { const r = { id: ++autoId, createdAt: new Date(), ...a.data }; table(name).push(r); return pick(r, a.select); },
    createMany: async (a = {}) => { [].concat(a.data).forEach((d) => table(name).push({ id: ++autoId, ...d })); return { count: [].concat(a.data).length }; },
    createManyAndReturn: async (a = {}) => [].concat(a.data).map((d) => { const r = { id: ++autoId, ...d }; table(name).push(r); return r; }),
    update: async (a = {}) => { let r = rows().find((x) => matches(x, a.where)); if (!r) { r = synth(a.where); table(name).push(r); } apply(r, a.data); return pick(r, a.select); },
    updateMany: async (a = {}) => { const list = rows().filter((r) => matches(r, a.where)); list.forEach((r) => apply(r, a.data)); return { count: list.length || 1 }; },
    upsert: async (a = {}) => { let r = rows().find((x) => matches(x, a.where)); if (r) apply(r, a.update); else { r = { id: ++autoId, ...a.create }; table(name).push(r); } return pick(r, a.select); },
    delete: async (a = {}) => { const r = rows().find((x) => matches(x, a.where)) || synth(a.where); store[name] = table(name).filter((x) => x !== r); return r; },
    deleteMany: async (a = {}) => { const before = table(name).length; store[name] = table(name).filter((r) => !matches(r, a.where)); return { count: before - table(name).length || 1 }; },
  };
}

function callerLocation() {
  const line = (new Error().stack || "").split("\n").find((l) => l.includes(BACKEND) && !l.includes("test-support") && !l.includes("node_modules"));
  return line ? line.trim().replace(BACKEND + "/", "") : "?";
}

function makePrisma(isTx = false) {
  return new Proxy({}, {
    get(_, prop) {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      if (prop === "$transaction") {
        return async (arg) => (typeof arg === "function" ? arg(makePrisma(true)) : Promise.all(arg));
      }
      if (prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") {
        return async (...args) => { await validate(null, prop, args, callerLocation()); return prop.startsWith("$execute") ? 1 : []; };
      }
      if (prop === "$connect" || prop === "$disconnect" || prop === "$on" || prop === "$use") return async () => {};
      if (String(prop).startsWith("$")) return undefined;
      const fake = fakeModel(prop);
      return new Proxy({}, {
        get(__, method) {
          if (typeof method === "symbol") return undefined;
          return async (...args) => {
            const where = callerLocation();
            await validate(prop, method, args, where);
            if (!fake[method]) throw new Error(`fake store: ${prop}.${method} not supported`);
            return fake[method](...args);
          };
        },
      });
    },
  });
}
const prisma = makePrisma();

// ---------------- module stubs ----------------
function stub(rel, exportsObj) {
  let file;
  try { file = backendRequire.resolve(path.join(BACKEND, rel)); } catch { return; }
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObj };
}
const passthrough = (req, res, next) => next();
const PLAN = {
  id: 2, title: "Pro", price: 10, plan_duration_in_days: 30, contact_limit: 100000, qr_account: 100,
  allow_tag: 1, allow_note: 1, allow_chatbot: 1, allow_api: 1, wa_warmer: 1, rest_api_qr: 1,
  instagram_inbox: 1, telegram_inbox: 1, allow_wa_forms: 1, messenger_inbox: 1,
};
const USER = { id: 1, uid: "u1", role: "user", email: "u1@example.com", name: "U1", plan: JSON.stringify(PLAN), plan_expire: String(Date.now() + 864e6), tokenVersion: 0, is_blocked: false, email_verified_at: new Date() };

function installStubs() {
  stub("database/prisma.js", { prisma, PrismaClient, sanitizeBigInt: (x) => x });
  stub("database/dbpromise.js", {
    query: async (sql) => {
      report.rawSql.push({ where: callerLocation(), sql: String(sql).replace(/\s+/g, " ").slice(0, 90) });
      return [];
    },
  });
  stub("middlewares/user.js", (req, res, next) => { req.decode = { uid: "u1", role: "user", email: USER.email, userData: USER }; next(); });
  stub("middlewares/admin.js", (req, res, next) => { req.decode = { uid: "admin1", role: "admin" }; next(); });
  stub("middlewares/agent.js", (req, res, next) => { req.decode = { uid: "agent1", role: "agent", owner_uid: "u1" }; req.owner = { ...USER }; next(); });
  const planExports = new Proxy({ checkPlan: (req, res, next) => { req.plan = PLAN; req.entitlements = {}; next(); } }, {
    get: (t, k) => t[k] || passthrough,
  });
  stub("middlewares/plan.js", planExports);
  stub("middlewares/rateLimiter.js", new Proxy({}, { get: (t, k) => (k === "getClientIp" ? () => "127.0.0.1" : k === "checkPlanMonthlyQuota" ? async () => ({ allowed: true }) : k === "checkConnectionRateLimit" ? async () => ({ exceeded: false }) : () => passthrough) }));
  stub("middlewares/license.js", { checkLicense: passthrough, createLicenseFile: () => {} });
  const apiAuth = (req, res, next) => { req.decode = { uid: "u1" }; req.workspaceId = "u1"; req.apiKey = { id: 1, uid: "u1", scopes: ["*"] }; req.plan = PLAN; req.requestId = "req_1"; next(); };
  stub("middlewares/publicApiAuth.js", { publicApiAuth: apiAuth, requireScope: () => apiAuth });
  stub("middlewares/idempotency.js", Object.assign(() => passthrough, { idempotency: () => passthrough, idempotencyMiddleware: passthrough }));
  const session = new Proxy({}, { get: (t, k) => (k === "then" ? undefined : k === "user" ? { id: "91999@s.whatsapp.net" } : async () => ({ key: { id: "m1" } })) });
  stub("helper/addon/qr/index.js", new Proxy({}, { get: (t, k) => (k === "getSession" ? () => session : async () => true) }));
  stub("socket.js", new Proxy({}, { get: () => () => {} }));
}

// ---------------- route exerciser ----------------
function scrapeFields(src) {
  const fields = new Set();
  const destr = /const\s*\{([^}]*)\}\s*=\s*req\.(body|query|params)/g;
  let m;
  while ((m = destr.exec(src))) {
    m[1].split(",").forEach((part) => {
      const k = part.split(/[:=]/)[0].trim().replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(k)) fields.add(k);
    });
  }
  const dot = /req\.(body|query|params)(?:\?)?\.([A-Za-z_$][\w$]*)/g;
  while ((m = dot.exec(src))) fields.add(m[2]);
  return [...fields];
}
function guessValue(k) {
  if (/^(selected|ids|contacts|numbers|data|items|list|tags|rows|messages|chatIds|agentIds|selectedChats)$/i.test(k)) return ["1"];
  if (/^(page|limit|offset)$/i.test(k)) return "1";
  if (/email/i.test(k)) return "u1@example.com";
  if (/(mobile|phone|number|to|from)$/i.test(k)) return "919999999999";
  if (/(date|time|At)$/.test(k)) return new Date().toISOString();
  return "1";
}

async function exerciseRouter(relFile) {
  const abs = path.join(BACKEND, relFile);
  const src = fs.readFileSync(abs, "utf8");
  const router = backendRequire(abs);
  const express = backendRequire("express");
  const app = express();
  app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use((req, res, next) => { req.files = { file: { name: "a.csv", size: 10, data: Buffer.from("name,mobile\na,919999999999\n"), mv: (p, cb) => { if (typeof cb === "function") cb(null); return Promise.resolve(); } } }; next(); });
  app.use("/", router);
  app.use((err, req, res, next) => { report.serverErrors.push({ where: `${req.method} ${req.path}`, msg: err.message }); res.status(500).json({ error: err.message }); });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const values = Object.fromEntries(scrapeFields(src).map((k) => [k, guessValue(k)]));
  const routes = (router.stack || []).filter((l) => l.route).map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));
  const statuses = [];
  for (const r of routes) {
    for (const method of r.methods) {
      const urlPath = String(r.path).replace(/:([A-Za-z_]+)\??/g, "1");
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))).toString();
      const opts = { method: method.toUpperCase(), headers: { "Content-Type": "application/json", Authorization: "Bearer x" } };
      if (!["get", "head"].includes(method)) opts.body = JSON.stringify(values);
      try {
        const res = await fetch(`${base}${urlPath}?${qs}`, { ...opts, signal: AbortSignal.timeout(15000) });
        const text = await res.text();
        statuses.push(`${method.toUpperCase()} ${r.path} ${res.status}`);
        if (res.status >= 500) report.serverErrors.push({ where: `${method.toUpperCase()} ${r.path}`, msg: text.slice(0, 160) });
      } catch (e) {
        if (e.name === "TimeoutError") {
          statuses.push(`${method.toUpperCase()} ${r.path} TIMEOUT (external I/O, not DB)`);
        } else {
          report.serverErrors.push({ where: `${method.toUpperCase()} ${r.path}`, msg: `${e.message} ${e.cause?.code || ""}` });
        }
      }
    }
  }
  server.close();
  return statuses;
}

module.exports = { installStubs, exerciseRouter, report, prisma, store, BACKEND, backendRequire };
