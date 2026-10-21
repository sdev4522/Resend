// backend/test-email-verification-and-admin-mgmt.mjs
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import assert from "assert";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const FRONTEND_URL = "http://localhost:3000";
const JWT_SECRET = process.env.JWTKEY;

async function runTestSuite() {
  console.log("========================================================================");
  console.log("🔒 RESEND EMAIL VERIFICATION & ADMIN MANAGEMENT REGRESSION TEST SUITE");
  console.log("========================================================================\n");

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

  // Retrieve admin account
  const adminRows = await query("SELECT uid, role, email, tokenVersion FROM admin LIMIT 1");
  assert(adminRows.length > 0, "Admin account must exist");
  const adminUid = adminRows[0].uid;
  const adminToken = jwt.sign(
    { uid: adminUid, role: "admin", tokenVersion: adminRows[0].tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const testEmail = `test_sec_${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";
  let testUserUid = null;
  let testUserId = null;

  // ------------------------------------------------------------------------
  // PART 1: REGISTRATION & UNVERIFIED LOGIN SECURITY
  // ------------------------------------------------------------------------

  await test("1. New registration creates an unverified user account", async () => {
    const randomIp = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const res = await fetch(`${BACKEND_URL}/api/user/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": randomIp,
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Security Test User",
        mobile_with_country_code: "+15550001111",
        acceptPolicy: true,
        turnstileToken: "valid_test_token_success",
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.email_verification_required, true);

    const userInDb = await query("SELECT id, uid, email, email_verified_at FROM user WHERE email = ?", [testEmail]);
    assert.strictEqual(userInDb.length, 1);
    assert.strictEqual(userInDb[0].email_verified_at, null, "email_verified_at must be NULL for new accounts");
    testUserUid = userInDb[0].uid;
    testUserId = userInDb[0].id;
  });

  await test("2. Frontend registration API sets no session cookie", async () => {
    const regRes = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `sec_reg_${Date.now()}@example.com`,
        password: testPassword,
        name: "Cookie Check User",
        mobile_with_country_code: "+15550002222",
        acceptPolicy: true,
        turnstileToken: "valid_test_token_success",
      }),
    });
    const setCookie = regRes.headers.get("set-cookie") || "";
    assert(!setCookie.includes("wacrm_session="), "Registration must not issue wacrm_session cookie");
  });

  await test("3. Direct backend password login for unverified account is rejected with 403 EMAIL_VERIFICATION_REQUIRED", async () => {
    const res = await fetch(`${BACKEND_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.strictEqual(data.token, undefined, "No JWT token may be returned");
    const cacheControl = res.headers.get("cache-control") || "";
    assert(cacheControl.includes("no-store"), "Must set Cache-Control: no-store");
  });

  await test("4. Frontend login route intercepts unverified account without setting session cookie", async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert.strictEqual(data.code, "EMAIL_VERIFICATION_REQUIRED");
    const setCookie = res.headers.get("set-cookie") || "";
    assert(!setCookie.includes("wacrm_session="), "Frontend login must not set session cookie for unverified user");
  });

  await test("5. Invalid credentials return 401 without verification leakage", async () => {
    const res = await fetch(`${BACKEND_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword123!",
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
  });

  // ------------------------------------------------------------------------
  // PART 2: PROTECTED USER API & SESSION ENFORCEMENT
  // ------------------------------------------------------------------------

  await test("6. Backend validateUser middleware rejects unverified account token with 403 EMAIL_VERIFICATION_REQUIRED", async () => {
    // Generate forged token for unverified user
    const forgedToken = jwt.sign(
      { uid: testUserUid, role: "user", tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await fetch(`${BACKEND_URL}/api/user/get_me`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.strictEqual(data.logout, true);
  });

  await test("7. Next.js /api/auth/me revokes session cookie if unverified account reaches it", async () => {
    const forgedToken = jwt.sign(
      { uid: testUserUid, role: "user", tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      headers: {
        Cookie: `wacrm_session=${forgedToken}; wacrm_role=user`,
      },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.code, "EMAIL_VERIFICATION_REQUIRED");
    const setCookie = res.headers.get("set-cookie") || "";
    assert(setCookie.includes("wacrm_session=;") || setCookie.includes("Max-Age=0"), "Must delete session cookie");
  });

  // ------------------------------------------------------------------------
  // PART 3: OTP VERIFICATION & LIFECYCLE
  // ------------------------------------------------------------------------

  await test("8. Verification token record exists in DB with secure token_hash", async () => {
    const rows = await query("SELECT * FROM email_verification WHERE uid = ? AND used_at IS NULL", [testUserUid]);
    assert(rows.length > 0, "Verification record must exist in email_verification table");
    assert(rows[0].token_hash, "token_hash column must be populated");
    assert.strictEqual(rows[0].used_at, null, "used_at must be NULL initially");
  });

  await test("9. Invalid verification code is rejected with 400", async () => {
    const res = await fetch(`${BACKEND_URL}/api/user/verify_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        otp: "000000",
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, "INVALID_CODE");
  });

  await test("10. Valid OTP verifies account, marks email_verified_at, and issues verified JWT", async () => {
    // Generate known test OTP and hash
    const testOtp = "654321";
    const otpHash = crypto
      .createHash("sha256")
      .update(`${testEmail}_${testOtp}`)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Invalidate existing tokens and insert test token
    await query("UPDATE email_verification SET used_at = CURRENT_TIMESTAMP WHERE uid = ?", [testUserUid]);
    await query(
      "INSERT INTO email_verification (uid, email, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [testUserUid, testEmail, otpHash, expiresAt]
    );

    const res = await fetch(`${BACKEND_URL}/api/user/verify_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        otp: testOtp,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert(data.token, "Verified token must be issued");

    const decoded = jwt.verify(data.token, JWT_SECRET);
    assert.strictEqual(decoded.emailVerified, true, "JWT must contain emailVerified: true");

    const userDb = await query("SELECT email_verified_at FROM user WHERE uid = ?", [testUserUid]);
    assert(userDb[0].email_verified_at !== null, "email_verified_at must be recorded in database");

    const tokenDb = await query("SELECT used_at FROM email_verification WHERE uid = ? AND token_hash = ?", [testUserUid, otpHash]);
    assert(tokenDb[0].used_at !== null, "OTP token must be marked as used");
  });

  await test("11. Consumed OTP token cannot be reused", async () => {
    // Unset email_verified_at temporarily to test code consumption check
    await query("UPDATE user SET email_verified_at = NULL WHERE uid = ?", [testUserUid]);

    const res = await fetch(`${BACKEND_URL}/api/user/verify_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        otp: "654321",
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400, "Consumed token must be rejected");
    assert.strictEqual(data.code, "ALREADY_USED");

    // Re-mark verified
    await query("UPDATE user SET email_verified_at = CURRENT_TIMESTAMP WHERE uid = ?", [testUserUid]);
  });

  await test("12. Verified user can log in normally and access protected APIs", async () => {
    const loginRes = await fetch(`${BACKEND_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginData.success, true);
    assert(loginData.token, "Login token must be provided");

    const meRes = await fetch(`${BACKEND_URL}/api/user/get_me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.data.email, testEmail);
  });

  // ------------------------------------------------------------------------
  // PART 4: ADMIN EMAIL VERIFICATION STATUS & MANAGEMENT
  // ------------------------------------------------------------------------

  await test("13. GET /api/admin/get_users returns authoritative email_status and email_verified_at", async () => {
    const res = await fetch(`${BACKEND_URL}/api/admin/get_users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert(Array.isArray(data.data));

    const testUserRow = data.data.find((u) => u.uid === testUserUid);
    assert(testUserRow, "Test user must appear in admin list");
    assert.strictEqual(testUserRow.email_status, "verified");
    assert(testUserRow.email_verified_at !== null, "email_verified_at timestamp must be present");
  });

  await test("14. Admin user filtering by email_status filters accurately", async () => {
    const verifiedRes = await fetch(`${BACKEND_URL}/api/admin/get_users?email_status=verified`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifiedData = await verifiedRes.json();
    assert(Array.isArray(verifiedData.data));
    assert(verifiedData.data.every((u) => u.email_status === "verified"), "All returned users must have email_status = verified");

    const unverifiedRes = await fetch(`${BACKEND_URL}/api/admin/get_users?email_status=unverified`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const unverifiedData = await unverifiedRes.json();
    assert(Array.isArray(unverifiedData.data));
    assert(unverifiedData.data.every((u) => u.email_status === "unverified" || u.email_status === "pending" || u.email_status === "unknown"), "Non-verified filter must return non-verified users");
  });

  await test("15. POST /api/admin/verify_user_email allows manual administrative email verification", async () => {
    // Create an unverified user
    const manualUserEmail = `manual_verify_${Date.now()}@example.com`;
    const randomIp = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const regRes = await fetch(`${BACKEND_URL}/api/user/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": randomIp,
      },
      body: JSON.stringify({
        email: manualUserEmail,
        password: testPassword,
        name: "Manual Verify Test",
        mobile_with_country_code: "+15550003333",
        acceptPolicy: true,
        turnstileToken: "valid_test_token_success",
      }),
    });
    const regData = await regRes.json();
    assert.strictEqual(regData.success, true);

    const manualUser = (await query("SELECT uid FROM user WHERE email = ?", [manualUserEmail]))[0];

    // Admin verifies
    const verifyRes = await fetch(`${BACKEND_URL}/api/admin/verify_user_email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid: manualUser.uid }),
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyData.success, true);

    const userDb = (await query("SELECT email_verified_at FROM user WHERE uid = ?", [manualUser.uid]))[0];
    assert(userDb.email_verified_at !== null, "User must now have email_verified_at set");

    // Clean up
    await query("DELETE FROM user WHERE uid = ?", [manualUser.uid]);
  });

  // ------------------------------------------------------------------------
  // PART 5: SAFE BULK USER DELETION
  // ------------------------------------------------------------------------

  await test("16. POST /api/admin/delete_users rejects unauthorized non-admin requests", async () => {
    const normalUserToken = jwt.sign(
      { uid: testUserUid, role: "user", tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const res = await fetch(`${BACKEND_URL}/api/admin/delete_users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${normalUserToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds: [testUserUid] }),
    });
    assert([401, 403].includes(res.status), "Non-admin must be rejected with 401 or 403");
  });

  await test("17. POST /api/admin/delete_users rejects empty userIds array", async () => {
    const res = await fetch(`${BACKEND_URL}/api/admin/delete_users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds: [] }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
  });

  await test("18. POST /api/admin/delete_users protects root admin and caller admin", async () => {
    const res = await fetch(`${BACKEND_URL}/api/admin/delete_users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds: [adminUid] }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert(data.msg.includes("Protected"), "Must prevent deletion of admin account");
  });

  await test("19. POST /api/admin/delete_users transactionally cleans up tenant data while preserving statutory orders", async () => {
    // Create 2 test users to bulk delete
    const emailA = `bulk_a_${Date.now()}@example.com`;
    const emailB = `bulk_b_${Date.now()}@example.com`;

    const ipA = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const ipB = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;

    await fetch(`${BACKEND_URL}/api/user/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipA },
      body: JSON.stringify({ email: emailA, password: testPassword, name: "Bulk A", mobile_with_country_code: "+15559990001", acceptPolicy: true, turnstileToken: "valid_test_token_success" }),
    });
    await fetch(`${BACKEND_URL}/api/user/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ipB },
      body: JSON.stringify({ email: emailB, password: testPassword, name: "Bulk B", mobile_with_country_code: "+15559990002", acceptPolicy: true, turnstileToken: "valid_test_token_success" }),
    });

    const userA = (await query("SELECT id, uid FROM user WHERE email = ?", [emailA]))[0];
    const userB = (await query("SELECT id, uid FROM user WHERE email = ?", [emailB]))[0];
    assert(userA && userB, "Bulk test users must exist");

    // Seed dependent operational data
    await query("INSERT INTO instance (uid, title, number, uniqueId) VALUES (?, 'Test Instance', '+15550000000', ?)", [userA.uid, `uniq_${Date.now()}`]);
    await query("INSERT INTO contact (uid, phonebook_id, name, mobile) VALUES (?, 1, 'Contact A', '12345')", [userA.uid]);

    // Seed statutory financial order
    await query("INSERT INTO orders (uid, payment_mode, amount, status) VALUES (?, 'RAZORPAY', 99.00, 'PAID')", [userA.uid]);

    // Execute bulk delete with mix of id (integer) and uid (string)
    const delRes = await fetch(`${BACKEND_URL}/api/admin/delete_users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds: [userA.id, userB.uid] }),
    });
    const delData = await delRes.json();
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delData.success, true);
    assert.strictEqual(delData.deletedCount, 2);

    // Verify user records deleted
    const usersRemaining = await query("SELECT id FROM user WHERE uid IN (?, ?)", [userA.uid, userB.uid]);
    assert.strictEqual(usersRemaining.length, 0, "Users must be deleted from user table");

    // Verify tenant operational records purged
    const instancesRemaining = await query("SELECT id FROM instance WHERE uid = ?", [userA.uid]);
    assert.strictEqual(instancesRemaining.length, 0, "Instance records must be purged");

    const contactsRemaining = await query("SELECT id FROM contact WHERE uid = ?", [userA.uid]);
    assert.strictEqual(contactsRemaining.length, 0, "Contact records must be purged");

    // Verify statutory orders PRESERVED for financial audit
    const ordersRemaining = await query("SELECT id, status FROM orders WHERE uid = ?", [userA.uid]);
    assert.strictEqual(ordersRemaining.length, 1, "Financial order must be preserved for compliance");
    assert.strictEqual(ordersRemaining[0].status, "PAID");

    // Clean up statutory test order
    await query("DELETE FROM orders WHERE uid = ?", [userA.uid]);
  });

  // Clean up primary test user
  if (testUserId) {
    await fetch(`${BACKEND_URL}/api/admin/del_user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: testUserId }),
    });
  }

  console.log("\n========================================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("Fatal Test Runner Error:", err);
  process.exit(1);
});
