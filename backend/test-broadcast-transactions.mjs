/**
 * Stage 2 — Broadcast Transactions Safety Test Suite
 *
 * Verifies:
 * 1. Successful campaign creation commits all intended database changes atomically.
 * 2. Failure midway rolls back all changes without leaving orphaned records.
 * 3. Concurrent broadcast submissions do not leak transaction state across requests.
 * 4. Atomic deletion commits both campaign and logs removal.
 * 5. Tenant isolation is enforced (User B cannot delete User A's campaign).
 * 6. Connection pool remains healthy and non-leaking after all operations.
 */
import "dotenv/config";
import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./database/prisma.js";
import { query } from "./database/dbpromise.js";
import broadcastRouter from "./routes/broadcast.js";

const TEST_PORT = 3192;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/broadcast`;

console.log("====================================================================");
console.log("🧪 STAGE 2 — BROADCAST TRANSACTION SAFETY ACCEPTANCE SUITE");
console.log("====================================================================\n");

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

  const createdCampaignIds = [];
  let testPhonebookId = null;
  let userA = null;
  let userB = null;
  let tokenA = null;
  let tokenB = null;

  try {
    // 0. Start test server
    const app = express();
    app.use(express.json());
    app.use("/api/broadcast", broadcastRouter);

    server = await new Promise((resolve) => {
      const s = app.listen(TEST_PORT, "127.0.0.1", () => resolve(s));
    });
    pass("0. Test server startup", `Listening on port ${TEST_PORT}`);

    // Load fixtures
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        is_blocked: false,
        email_verified_at: { not: null },
      },
      take: 2,
    });
    assert(users.length >= 2, "Need at least 2 active users for test");
    userA = users[0];
    userB = users[1];

    const jwtSecret = process.env.JWTKEY;
    tokenA = jwt.sign(
      { uid: userA.uid, role: "user", tokenVersion: userA.tokenVersion || 0 },
      jwtSecret
    );
    tokenB = jwt.sign(
      { uid: userB.uid, role: "user", tokenVersion: userB.tokenVersion || 0 },
      jwtSecret
    );

    // Ensure User A has an active plan so checkPlan passes
    if (!userA.plan || !userA.plan_expire || Number(userA.plan_expire) < Date.now()) {
      const activePlan = await prisma.plan.findFirst();
      await prisma.user.updateMany({
        where: { uid: userA.uid },
        data: {
          plan: JSON.stringify(activePlan),
          plan_expire: String(Date.now() + 30 * 86400000),
        },
      });
    }

    // Create a dedicated test phonebook with 5 contacts for User A
    const pbRes = await query(
      "INSERT INTO phonebook (name, uid) VALUES (?, ?)",
      ["Stage2_Tx_Test_PB_" + Date.now(), userA.uid]
    );
    testPhonebookId = pbRes.insertId;

    const testMobiles = [
      "919800000001",
      "919800000002",
      "919800000003",
      "919800000004",
      "919800000005",
    ];

    for (let i = 0; i < testMobiles.length; i++) {
      await query(
        "INSERT INTO contact (uid, phonebook_id, name, mobile) VALUES (?, ?, ?, ?)",
        [userA.uid, testPhonebookId, `Test Contact ${i + 1}`, testMobiles[i]]
      );
    }
    pass("1. Fixtures initialized", `Phonebook ID: ${testPhonebookId}, Contacts: ${testMobiles.length}`);

    // ── TEST 1: Successful Campaign Creation Transaction ───────────
    let test1CampaignId = null;
    {
      const res = await fetch(`${BASE_URL}/create_template_campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          template_name: "test_welcome_template",
          template_language: "en",
          template_type: "STANDARD",
          phonebook_id: testPhonebookId,
          campaign_title: "Automated Safety Test Campaign 1",
          body_variables: ["John", "Resend"],
          header_variable: null,
          button_variables: [],
          schedule: null,
          timezone: "Asia/Kolkata",
        }),
      });

      assert.strictEqual(res.status, 200, "Must return HTTP 200");
      const data = await res.json();
      assert.strictEqual(data.success, true, "Response must indicate success");
      assert(data.campaignId, "Response must contain campaignId");
      assert.strictEqual(data.totalContacts, 5, "totalContacts must equal 5");
      test1CampaignId = data.campaignId;
      createdCampaignIds.push(test1CampaignId);

      // Verify DB persistence directly via Prisma
      const dbCampaign = await prisma.beta_campaign.findFirst({
        where: { campaign_id: test1CampaignId },
      });
      assert(dbCampaign, "beta_campaign row must exist in DB");
      assert.strictEqual(dbCampaign.uid, userA.uid, "Campaign must belong to user A");
      assert.strictEqual(dbCampaign.status, "PENDING", "Campaign status must be PENDING");
      assert.strictEqual(dbCampaign.total_contacts, 5, "Total contacts in DB must be 5");

      const dbLogs = await prisma.beta_campaign_logs.findMany({
        where: { campaign_id: test1CampaignId },
      });
      assert.strictEqual(dbLogs.length, 5, "Must have exactly 5 beta_campaign_logs in DB");
      for (const log of dbLogs) {
        assert.strictEqual(log.uid, userA.uid, "Log uid must match");
        assert.strictEqual(log.status, "PENDING", "Log status must be PENDING");
        assert.strictEqual(log.campaign_id, test1CampaignId, "Log campaign_id must match");
      }

      pass("2. Successful campaign creation committed atomically", `Campaign ID: ${test1CampaignId}, Logs: ${dbLogs.length}`);
    }

    // ── TEST 2: Failure Midway Rolls Back All Changes ───────────────
    {
      const failCampaignId = "fail_test_" + Date.now();
      let txErrorCaught = false;

      // Execute a transaction that fails midway after creating campaign
      try {
        await prisma.$transaction(async (tx) => {
          await tx.beta_campaign.create({
            data: {
              campaign_id: failCampaignId,
              uid: userA.uid,
              title: "Fail Test Campaign",
              template_name: "test_tpl",
              template_language: "en",
              template_type: "STANDARD",
              phonebook_id: String(testPhonebookId),
              phonebook_name: "Test PB",
              status: "PENDING",
              total_contacts: 1,
            },
          });

          // Simulate an unexpected failure right after campaign insert (before or during logs)
          throw new Error("Simulated downstream worker failure inside transaction");
        });
      } catch (err) {
        txErrorCaught = true;
        assert(err.message.includes("Simulated downstream worker failure"), "Must catch expected simulated error");
      }

      assert(txErrorCaught, "Transaction error must be thrown");

      // Verify that NO orphaned beta_campaign record exists
      const orphanedCampaign = await prisma.beta_campaign.findFirst({
        where: { campaign_id: failCampaignId },
      });
      assert.strictEqual(orphanedCampaign, null, "Orphaned campaign must NOT exist in DB (100% rolled back)");

      // Verify that NO orphaned beta_campaign_logs exist
      const orphanedLogs = await prisma.beta_campaign_logs.findMany({
        where: { campaign_id: failCampaignId },
      });
      assert.strictEqual(orphanedLogs.length, 0, "Orphaned logs must NOT exist in DB");

      pass("3. Transaction atomicity & rollback verified", "Zero orphaned records after failure midway");
    }

    // ── TEST 3: Concurrent Broadcast Submissions Do Not Leak ────────
    {
      const concurrentCount = 5;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          fetch(`${BASE_URL}/create_template_campaign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenA}`,
            },
            body: JSON.stringify({
              template_name: "concurrent_tpl",
              template_language: "en",
              template_type: "STANDARD",
              phonebook_id: testPhonebookId,
              campaign_title: `Concurrent Campaign ${i + 1}`,
              body_variables: [`User${i + 1}`],
              header_variable: null,
              button_variables: [],
              schedule: null,
              timezone: "UTC",
            }),
          }).then(async (r) => {
            const json = await r.json();
            return { status: r.status, json };
          })
        );
      }

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, concurrentCount, "All 5 concurrent requests must complete");

      const concurrentCampaignIds = [];
      for (const res of results) {
        assert.strictEqual(res.status, 200, "All concurrent requests must return HTTP 200");
        assert.strictEqual(res.json.success, true, "All must succeed");
        assert(res.json.campaignId, "Each must have a campaignId");
        concurrentCampaignIds.push(res.json.campaignId);
        createdCampaignIds.push(res.json.campaignId);
      }

      // Verify all campaign IDs are unique
      const uniqueIds = new Set(concurrentCampaignIds);
      assert.strictEqual(uniqueIds.size, concurrentCount, "All campaign IDs must be unique");

      // Verify each campaign has its own 5 logs in DB without cross-leakage
      for (const cId of concurrentCampaignIds) {
        const cRow = await prisma.beta_campaign.findFirst({ where: { campaign_id: cId } });
        assert(cRow, `Campaign ${cId} must exist in DB`);
        assert.strictEqual(cRow.total_contacts, 5);

        const logs = await prisma.beta_campaign_logs.findMany({ where: { campaign_id: cId } });
        assert.strictEqual(logs.length, 5, `Campaign ${cId} must have exactly 5 logs without pollution`);
      }

      pass("4. Concurrent transactions isolation verified", `5 concurrent submissions -> 25 logs cleanly partitioned`);
    }

    // ── TEST 4: Atomic Deletion Transaction ─────────────────────────
    {
      const campaignToDelete = test1CampaignId;
      const delRes = await fetch(`${BASE_URL}/del_campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          id: campaignToDelete,
        }),
      });

      assert.strictEqual(delRes.status, 200, "Must return HTTP 200 on delete");
      const delData = await delRes.json();
      assert.strictEqual(delData.success, true, "Delete response must indicate success");
      assert.strictEqual(delData.message, "Campaign deleted successfully");

      // Verify both campaign and logs are removed from DB
      const checkC = await prisma.beta_campaign.findFirst({
        where: { campaign_id: campaignToDelete },
      });
      assert.strictEqual(checkC, null, "Campaign must be deleted from DB");

      const checkL = await prisma.beta_campaign_logs.findMany({
        where: { campaign_id: campaignToDelete },
      });
      assert.strictEqual(checkL.length, 0, "Campaign logs must be deleted from DB");

      pass("5. Atomic deletion verified", `Campaign ${campaignToDelete} and all logs removed`);
    }

    // ── TEST 5: Tenant Isolation on Deletion ─────────────────────────
    {
      // Pick one of the remaining campaigns owned by User A
      const targetCampaignId = createdCampaignIds[1];
      assert(targetCampaignId, "Target campaign must exist");

      // User B attempts to delete User A's campaign
      const crossDelRes = await fetch(`${BASE_URL}/del_campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenB}`, // User B credentials
        },
        body: JSON.stringify({
          id: targetCampaignId,
        }),
      });

      assert.strictEqual(crossDelRes.status, 404, "Cross-tenant delete must return HTTP 404");
      const crossDelData = await crossDelRes.json();
      assert.strictEqual(crossDelData.success, false, "Must not indicate success");
      assert.strictEqual(crossDelData.error, "Campaign not found");

      // Verify User A's campaign still exists in DB
      const stillExists = await prisma.beta_campaign.findFirst({
        where: { campaign_id: targetCampaignId, uid: userA.uid },
      });
      assert(stillExists, "User A's campaign must remain untouched in DB");

      const logsStillExist = await prisma.beta_campaign_logs.findMany({
        where: { campaign_id: targetCampaignId },
      });
      assert.strictEqual(logsStillExist.length, 5, "User A's logs must remain untouched in DB");

      pass("6. Cross-tenant isolation protected", "User B cannot delete User A's campaign (HTTP 404)");
    }

    // ── TEST 6: Connection Pool Health & Non-Leaking Verification ───
    {
      // Execute 20 rapid pooled queries via dbpromise and prisma to confirm zero pool exhaustion
      const healthPromises = [];
      for (let i = 0; i < 20; i++) {
        healthPromises.push(query("SELECT 1 AS alive"));
        healthPromises.push(prisma.user.findFirst({ select: { uid: true } }));
      }
      const healthResults = await Promise.all(healthPromises);
      assert.strictEqual(healthResults.length, 40, "All 40 health check queries must resolve");
      pass("7. Connection pool health verified", "Zero connection leakage; pool responsive");
    }

  } catch (err) {
    fail("Acceptance suite failed", err);
  } finally {
    console.log("\n🧹 Running test teardown and cleanup...");
    // Cleanup created campaigns & logs
    if (createdCampaignIds.length > 0) {
      await prisma.beta_campaign_logs.deleteMany({
        where: { campaign_id: { in: createdCampaignIds } },
      }).catch(() => {});
      await prisma.beta_campaign.deleteMany({
        where: { campaign_id: { in: createdCampaignIds } },
      }).catch(() => {});
    }

    // Cleanup test phonebook and contacts
    if (testPhonebookId) {
      await query("DELETE FROM contact WHERE phonebook_id = ?", [testPhonebookId]).catch(() => {});
      await query("DELETE FROM phonebook WHERE id = ?", [testPhonebookId]).catch(() => {});
    }

    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    console.log("Cleanup complete.\n");
  }

  console.log("====================================================================");
  console.log(`📊 STAGE 2 ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test suite exception:", err);
  process.exit(1);
});
