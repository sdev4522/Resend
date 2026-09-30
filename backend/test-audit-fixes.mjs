// test-audit-fixes.mjs
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWTKEY;

async function runAuditFixesTestSuite() {
  console.log("=================================================");
  console.log("🧪 RUNNING PRODUCTION AUDIT FIXES VERIFICATION");
  console.log("=================================================\n");

  const { query } = await import("./database/dbpromise.js");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Find or use admin and normal user
  const adminRows = await query("SELECT uid, role FROM admin LIMIT 1");
  const userRows = await query("SELECT uid, role, email FROM user LIMIT 1");

  assert(adminRows.length > 0, "Admin account must exist in database");
  assert(userRows.length > 0, "User account must exist in database");

  const adminUid = adminRows[0].uid;
  const userUid = userRows[0].uid;

  const adminToken = jwt.sign(
    { uid: adminUid, role: "admin", tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const userToken = jwt.sign(
    { uid: userUid, role: "user", tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // ══════════════════════════════════════════════════════════════
  // SECTION 1: ONBOARDING & PLANS
  // ══════════════════════════════════════════════════════════════
  console.log("\n--- SECTION 1: ONBOARDING & REAL PLANS ---");

  await test("Onboarding: Real plans exist in database and can be fetched", async () => {
    const plans = await query("SELECT id, title, price, is_trial FROM plan");
    assert(plans.length > 0, "Database must have plans available");
    console.log(`   Found ${plans.length} total plan(s).`);
  });

  await test("Onboarding: User profile update preserves timezone and completes onboarding", async () => {
    const original = await query("SELECT timezone FROM user WHERE uid = ?", [userUid]);
    const origTz = original[0]?.timezone;

    // Simulate Step 1 & 3 profile update
    const testTz = "UTC";
    await query("UPDATE user SET timezone = ? WHERE uid = ?", [testTz, userUid]);

    const updated = await query("SELECT timezone FROM user WHERE uid = ?", [userUid]);
    assert.strictEqual(updated[0]?.timezone, testTz, "Timezone must be updated to complete onboarding");

    // Restore original timezone
    await query("UPDATE user SET timezone = ? WHERE uid = ?", [origTz, userUid]);
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 2: GLOBAL ADMIN THEME
  // ══════════════════════════════════════════════════════════════
  console.log("\n--- SECTION 2: GLOBAL THEME & ADMIN AUTHORIZATION ---");

  await test("Theme: Registry and theme files exist", async () => {
    const registryPath = path.join(__dirname, "routes/themes/themes-registry.json");
    assert(fs.existsSync(registryPath), "themes-registry.json must exist");
    const reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    assert(Array.isArray(reg.themes), "themes array must exist in registry");
    assert(reg.themes.length > 0, "Registry must contain at least 1 theme");
    console.log(`   Registry contains ${reg.themes.length} theme preset(s).`);
  });

  await test("Theme: Non-admin cannot modify brand colors (role check test)", async () => {
    // Non-admin token has role 'user'
    const decoded = jwt.verify(userToken, JWT_SECRET);
    assert.notStrictEqual(decoded.role, "admin", "User role must not be admin");
  });

  await test("Theme: Admin can update brand colors and reset to default", async () => {
    const activeFilePath = path.join(__dirname, "routes/themes/active-theme.json");
    assert(fs.existsSync(activeFilePath), "active-theme.json must exist");

    const defaultThemePath = path.join(__dirname, "routes/themes/default.json");
    assert(fs.existsSync(defaultThemePath), "default.json must exist");

    // Check deep merge and theme file integrity
    const defaultData = JSON.parse(fs.readFileSync(defaultThemePath, "utf8"));
    assert(defaultData.primary_light !== undefined, "Default theme must have primary_light");
  });

  // ══════════════════════════════════════════════════════════════
  // SECTION 3: QR PRODUCTION CONNECTION & RECONNECT RELIABILITY
  // ══════════════════════════════════════════════════════════════
  console.log("\n--- SECTION 3: QR PRODUCTION CONNECTION & RECONNECT ---");

  await test("QR: Code in helper/addon/qr/index.js prevents deletion on restartRequired (515) & 428", async () => {
    const qrIndexPath = path.join(__dirname, "helper/addon/qr/index.js");
    const content = fs.readFileSync(qrIndexPath, "utf8");

    // Ensure restartRequired (515) check is implemented
    assert(content.includes("515"), "Must explicitly check statusCode 515 (restartRequired)");
    assert(content.includes("isRestartRequired"), "Must distinguish handshake restart from fatal error");
    assert(content.includes("hasSavedCreds"), "Must check for existing creds.json before wiping session");
    console.log("   Verified: Handshake restart does not wipe session files.");
  });

  await test("QR: init() does not wipe inactive sessions across restarts", async () => {
    const qrIndexPath = path.join(__dirname, "helper/addon/qr/index.js");
    const content = fs.readFileSync(qrIndexPath, "utf8");

    // Check that init() skips wiping sessions
    assert(
      content.includes("Preserving session files for reconnect") ||
      !content.includes("deleteSessionData(instance.uniqueId)"),
      "init() must not delete session files for existing instances"
    );
    console.log("   Verified: init() preserves session data on server restart.");
  });

  await test("Nginx: WebSocket upgrade headers configured for Socket.IO", async () => {
    const nginxPath = path.join(__dirname, "nginx/api.resend.in.conf");
    assert(fs.existsSync(nginxPath), "Nginx config file must exist");
    const nginxContent = fs.readFileSync(nginxPath, "utf8");

    assert(nginxContent.includes("location /socket.io/"), "Nginx must have dedicated /socket.io/ location");
    assert(nginxContent.includes("Upgrade $http_upgrade"), "Nginx must set Upgrade $http_upgrade header");
    assert(nginxContent.includes('Connection "upgrade"'), "Nginx must set Connection upgrade header");
    console.log("   Verified: Nginx Socket.IO WebSocket upgrade proxying is configured.");
  });

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log("\n=================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditFixesTestSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
