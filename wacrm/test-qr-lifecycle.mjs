// test-qr-lifecycle.mjs
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import assert from "assert";

dotenv.config({ path: "./.env" });

const BACKEND_URL = "http://localhost:3001";
const TEST_UID = "CPJcJHAachHc5e8AoQD0CqFZHQasKRlR";
const JWT_SECRET = process.env.JWTKEY;

const token = jwt.sign(
  { uid: TEST_UID, role: "user", tokenVersion: 0 },
  JWT_SECRET,
  { expiresIn: "1d" }
);

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });
  return res.json();
}

async function runSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING QR LIFECYCLE & RELIABILITY TEST SUITE");
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

  // 1. Initial State Check
  await test("Initial State: Account A is active in database", async () => {
    const rows = await query(
      "SELECT uniqueId, status, number FROM instance WHERE uid = ? AND status = 'ACTIVE'",
      [TEST_UID]
    );
    assert(rows.length >= 1, "Expected at least 1 active instance");
    console.log(`   Found active instance: ${rows[0].uniqueId}, number: ${rows[0].number}`);
  });

  // 2. Plan Entitlements: usage only counts ACTIVE accounts
  await test("Plan Entitlements: Usage only counts ACTIVE accounts", async () => {
    const { getUsage } = await import("./helper/entitlements.js");
    const activeCount = await getUsage(TEST_UID, "qr_accounts");
    assert(activeCount >= 1, "Should count active instances");

    // Insert a dummy PENDING row directly to test
    const dummyPendingId = `${TEST_UID}_dummy_pending_${Date.now()}`;
    await query(
      "INSERT INTO instance (uid, title, uniqueId, status) VALUES (?,?,?,?)",
      [TEST_UID, "Dummy Pending", dummyPendingId, "PENDING"]
    );

    const countAfterPending = await getUsage(TEST_UID, "qr_accounts");
    assert.strictEqual(
      countAfterPending,
      activeCount,
      "Pending instances MUST NOT increment qr_accounts usage"
    );

    // Clean up dummy
    await query("DELETE FROM instance WHERE uniqueId = ?", [dummyPendingId]);
  });

  // 3. get_instances filters out PENDING instances
  await test("get_instances: Does not return PENDING instances in account list", async () => {
    const dummyPendingId = `${TEST_UID}_dummy_pending_${Date.now()}`;
    await query(
      "INSERT INTO instance (uid, title, uniqueId, status) VALUES (?,?,?,?)",
      [TEST_UID, "Dummy Pending", dummyPendingId, "PENDING"]
    );

    const res = await api("/api/qr/get_instances");
    assert(res.success, "API call should succeed");
    const found = res.data.find((inst) => inst.uniqueId === dummyPendingId);
    assert(!found, "PENDING instance must NOT appear in get_instances list");

    // Clean up dummy
    await query("DELETE FROM instance WHERE uniqueId = ?", [dummyPendingId]);
  });

  // 4. Cancel Pending Session Flow
  await test("Cancel Pending: gen_qr -> cancel_pending cleans up DB immediately", async () => {
    const pendingId = `${TEST_UID}_test_cancel_${Date.now()}`;
    const genRes = await api("/api/qr/gen_qr", {
      method: "POST",
      body: JSON.stringify({
        title: "Test Cancel QR",
        uniqueId: pendingId,
      }),
    });
    assert(genRes.success, "gen_qr should succeed");

    // Verify row in DB has status 'PENDING'
    const [row] = await query(
      "SELECT uniqueId, status FROM instance WHERE uniqueId = ?",
      [pendingId]
    );
    assert(row, "Pending instance row should exist");
    assert.strictEqual(row.status, "PENDING", "Status should be PENDING");

    // Now call cancel_pending
    const cancelRes = await api("/api/qr/cancel_pending", {
      method: "POST",
      body: JSON.stringify({ uniqueId: pendingId }),
    });
    assert(cancelRes.success, "cancel_pending should succeed");

    // Verify row is deleted
    const [rowAfter] = await query(
      "SELECT uniqueId FROM instance WHERE uniqueId = ?",
      [pendingId]
    );
    assert(!rowAfter, "Pending row should be deleted after cancel");

    // Verify existing active accounts still untouched
    const activeRows = await query(
      "SELECT uniqueId, status FROM instance WHERE uid = ? AND status = 'ACTIVE'",
      [TEST_UID]
    );
    assert(activeRows.length >= 1, "Existing account must remain ACTIVE");
  });

  // 5. The Exact Reproduction Bug Test: gen_qr -> unscanned -> expiry cleanup
  await test("Exact Bug Test: Unscanned QR expiration cleans up without affecting Account A", async () => {
    const unscannedId = `${TEST_UID}_unscanned_${Date.now()}`;
    const genRes = await api("/api/qr/gen_qr", {
      method: "POST",
      body: JSON.stringify({
        title: "Unscanned Test",
        uniqueId: unscannedId,
      }),
    });
    assert(genRes.success, "gen_qr should succeed");

    // Verify Account A is still ACTIVE
    const [accountA] = await query(
      "SELECT uniqueId, status, number FROM instance WHERE uid = ? AND status = 'ACTIVE' LIMIT 1",
      [TEST_UID]
    );
    assert(accountA, "Account A must remain ACTIVE");

    // Manually trigger expiration of the pending session to test cleanup logic
    const { expirePendingSession } = await import("./helper/addon/qr/index.js");
    await expirePendingSession(unscannedId);

    // Verify unscannedId row was deleted
    const [unscannedRow] = await query(
      "SELECT uniqueId FROM instance WHERE uniqueId = ?",
      [unscannedId]
    );
    assert(!unscannedRow, "Unscanned pending instance must be deleted on expiry");

    // Verify Account A is STILL ACTIVE and phone number untouched!
    const [accountAAfter] = await query(
      "SELECT uniqueId, status, number FROM instance WHERE uniqueId = ?",
      [accountA.uniqueId]
    );
    assert.strictEqual(accountAAfter.status, "ACTIVE", "Account A MUST remain ACTIVE");
    assert.strictEqual(accountAAfter.number, accountA.number, "Account A phone number must not change");
  });

  // 6. Reconnect Existing Inactive Instance
  await test("Reconnect: reconnect_instance reuses existing uniqueId without duplicate row", async () => {
    const reconnectId = `${TEST_UID}_reconnect_test`;
    // Create an inactive account row
    await query(
      "INSERT INTO instance (uid, title, uniqueId, status, number) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE status = 'INACTIVE'",
      [TEST_UID, "Inactive Account", reconnectId, "INACTIVE", "1234567890"]
    );

    const initialRows = await query(
      "SELECT COUNT(*) as count FROM instance WHERE uid = ?",
      [TEST_UID]
    );

    // Call reconnect_instance
    const reconRes = await api("/api/qr/reconnect_instance", {
      method: "POST",
      body: JSON.stringify({ uniqueId: reconnectId }),
    });
    assert(reconRes.success, "reconnect_instance should succeed");

    // Verify total count in DB did NOT increase
    const rowsAfter = await query(
      "SELECT COUNT(*) as count FROM instance WHERE uid = ?",
      [TEST_UID]
    );
    assert.strictEqual(rowsAfter[0].count, initialRows[0].count, "No duplicate rows allowed on reconnect");

    // Verify row status became PENDING
    const [reconRow] = await query(
      "SELECT uniqueId, status FROM instance WHERE uniqueId = ?",
      [reconnectId]
    );
    assert.strictEqual(reconRow.status, "PENDING", "Status should be PENDING during reconnect QR");

    // Clean up
    const { cancelPendingSession } = await import("./helper/addon/qr/index.js");
    await cancelPendingSession(reconnectId);
    await query("DELETE FROM instance WHERE uniqueId = ?", [reconnectId]);
  });

  // 7. Repeated get_instances calls do not mutate active accounts
  await test("Stability: 10 repeated get_instances calls leave active accounts stable", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await api("/api/qr/get_instances");
      assert(res.success, `Call ${i + 1} should succeed`);
      assert(res.data.length >= 1, "Should return existing account");
    }

    const activeRows = await query(
      "SELECT uniqueId, status FROM instance WHERE uid = ? AND status = 'ACTIVE'",
      [TEST_UID]
    );
    assert(activeRows.length >= 1, "Account A must remain ACTIVE after 10 calls");
  });

  console.log("\n=================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error("Test suite runner crashed:", err);
  process.exit(1);
});
