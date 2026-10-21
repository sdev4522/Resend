/**
 * Phase P2 — Prisma Data Access Layer Acceptance Test Suite
 * Module: templets (backend/routes/templet.js)
 * Tests full CRUD lifecycle, input validation, tenant isolation,
 * error handling, and co-existence with legacy dbpromise query helper.
 */
import "dotenv/config";
import assert from "node:assert";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./database/prisma.js";
import { query } from "./database/dbpromise.js";
import templetRouter from "./routes/templet.js";

const TEST_PORT = 3188;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/templet`;

console.log("====================================================================");
console.log("🧪 PHASE P2 — PRISMA DATA ACCESS LAYER (TEMPLETS) ACCEPTANCE SUITE");
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

  // Track created fixtures for deterministic cleanup
  const cleanupIds = [];

  try {
    // 0. Start isolated test server
    const app = express();
    app.use(express.json());
    app.use("/api/templet", templetRouter);

    server = await new Promise((resolve) => {
      const s = app.listen(TEST_PORT, "127.0.0.1", () => resolve(s));
    });
    pass("0. Test server startup", `Listening on port ${TEST_PORT}`);

    // Fetch two real test users with active plans and verified emails
    const users = await prisma.user.findMany({
      where: {
        role: "user",
        is_blocked: false,
        email_verified_at: { not: null },
      },
      take: 2,
    });

    assert(users.length >= 2, "Need at least 2 active users for tenant isolation testing");
    const userA = users[0];
    const userB = users[1];

    const jwtSecret = process.env.JWTKEY;
    const tokenA = jwt.sign({ uid: userA.uid, role: "user", tokenVersion: userA.tokenVersion || 0 }, jwtSecret);
    const tokenB = jwt.sign({ uid: userB.uid, role: "user", tokenVersion: userB.tokenVersion || 0 }, jwtSecret);

    const headersA = { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` };
    const headersB = { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` };

    pass("1. Test fixtures loaded", `User A: ${userA.email} (${userA.uid}), User B: ${userB.email} (${userB.uid})`);

    // 2. Unauthenticated access enforcement
    try {
      const res = await fetch(`${BASE_URL}/get_templets`);
      assert.strictEqual(res.status, 401, "Expected 401 Unauthorized when missing token");
      const body = await res.json();
      assert.strictEqual(body.success, false);
      pass("2. Auth enforcement - unauthenticated request rejected with 401");
    } catch (err) {
      fail("2. Auth enforcement - unauthenticated request rejected with 401", err);
    }

    // 3. Read initial templates for User A
    try {
      const res = await fetch(`${BASE_URL}/get_templets`, { headers: headersA });
      assert.strictEqual(res.status, 200, "Expected 200 OK");
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert(Array.isArray(body.data), "Expected data to be an array");
      pass("3. Read templates - initial GET /get_templets returns array", `Count: ${body.data.length}`);
    } catch (err) {
      fail("3. Read templates - initial GET /get_templets", err);
    }

    // 4. Input validation on POST /add_new (missing title)
    try {
      const res = await fetch(`${BASE_URL}/add_new`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ type: "TEXT", content: { text: "No title" } }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.msg, "Please give a title");
      pass("4. Input validation - missing title returns expected error");
    } catch (err) {
      fail("4. Input validation - missing title", err);
    }

    // 5. Input validation on POST /add_new (missing content)
    try {
      const res = await fetch(`${BASE_URL}/add_new`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ title: "Valid Title", type: "TEXT" }),
      });
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.msg, "Please give a title");
      pass("5. Input validation - missing content returns expected error");
    } catch (err) {
      fail("5. Input validation - missing content", err);
    }

    // 6. Successful creation of template by User A
    const tplTitleA = `Prisma_Test_Tpl_${Date.now()}`;
    const tplContentA = { text: "Hello {{name}}, this is a Prisma P2 test message!" };
    let createdTplIdA;

    try {
      const res = await fetch(`${BASE_URL}/add_new`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({
          title: tplTitleA,
          type: "TEXT",
          content: tplContentA,
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.msg, "Templet was added");

      // Verify row in database via Prisma
      const row = await prisma.templets.findFirst({
        where: { uid: userA.uid, title: tplTitleA },
      });
      assert(row, "Created template must exist in database");
      assert.strictEqual(row.type, "TEXT");
      assert.strictEqual(row.content, JSON.stringify(tplContentA));
      createdTplIdA = row.id;
      cleanupIds.push(createdTplIdA);

      pass("6. Create template - successful POST /add_new with DB persistence", `Template ID: ${createdTplIdA}`);
    } catch (err) {
      fail("6. Create template - successful POST /add_new", err);
    }

    // 7. Tenant isolation - User B cannot see User A's template
    try {
      const resB = await fetch(`${BASE_URL}/get_templets`, { headers: headersB });
      const bodyB = await resB.json();
      assert.strictEqual(bodyB.success, true);
      const hasUserATemplate = bodyB.data.some((t) => t.id === createdTplIdA || t.title === tplTitleA);
      assert.strictEqual(hasUserATemplate, false, "User B must not see User A's template");
      pass("7. Tenant isolation - User B cannot read User A's template");
    } catch (err) {
      fail("7. Tenant isolation - read boundary", err);
    }

    // 8. Tenant isolation - User B cannot delete User A's template
    try {
      const crossDelRes = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({ selected: [createdTplIdA] }),
      });
      assert.strictEqual(crossDelRes.status, 200);
      const crossDelBody = await crossDelRes.json();
      assert.strictEqual(crossDelBody.success, true);

      // Verify row still exists in database
      const rowStillExists = await prisma.templets.findUnique({
        where: { id: createdTplIdA },
      });
      assert(rowStillExists, "User A's template must remain intact in database after unauthorized delete attempt");
      pass("8. Tenant isolation - User B cannot delete User A's template (cross-tenant delete protected)");
    } catch (err) {
      fail("8. Tenant isolation - cross-tenant delete", err);
    }

    // 9. Cross-tenant delete protection with alternate format { id: <id> }
    try {
      const crossDelRes2 = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersB,
        body: JSON.stringify({ id: createdTplIdA }),
      });
      assert.strictEqual(crossDelRes2.status, 200);

      const rowStillExists2 = await prisma.templets.findUnique({
        where: { id: createdTplIdA },
      });
      assert(rowStillExists2, "User A's template must still exist after { id } payload delete attempt by User B");
      pass("9. Tenant isolation - User B cannot delete User A's template via { id } payload");
    } catch (err) {
      fail("9. Tenant isolation - { id } payload", err);
    }

    // 10. Delete non-existent ID gracefully
    try {
      const resNonExistent = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ selected: [99999999] }),
      });
      assert.strictEqual(resNonExistent.status, 200);
      const body = await resNonExistent.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.msg, "Contact(s) was deleted");
      pass("10. Missing records - deleting non-existent ID succeeds gracefully without error");
    } catch (err) {
      fail("10. Missing records - delete non-existent ID", err);
    }

    // 11. Malformed / empty delete payload gracefully handled
    try {
      const emptyRes = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({}),
      });
      assert.strictEqual(emptyRes.status, 200);
      const body = await emptyRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.msg, "Contact(s) was deleted");
      pass("11. Empty delete payload - handled safely without SQL syntax error");
    } catch (err) {
      fail("11. Empty delete payload", err);
    }

    // 12. Batch delete with array of IDs by owner
    // Create two more templates for User A
    const tplBatch1 = await prisma.templets.create({
      data: {
        uid: userA.uid,
        title: `Prisma_Batch_1_${Date.now()}`,
        type: "TEXT",
        content: JSON.stringify({ text: "Batch 1" }),
      },
    });
    const tplBatch2 = await prisma.templets.create({
      data: {
        uid: userA.uid,
        title: `Prisma_Batch_2_${Date.now()}`,
        type: "TEXT",
        content: JSON.stringify({ text: "Batch 2" }),
      },
    });
    cleanupIds.push(tplBatch1.id, tplBatch2.id);

    try {
      const batchDelRes = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ selected: [tplBatch1.id, tplBatch2.id] }),
      });
      assert.strictEqual(batchDelRes.status, 200);
      const body = await batchDelRes.json();
      assert.strictEqual(body.success, true);

      const [r1, r2] = await Promise.all([
        prisma.templets.findUnique({ where: { id: tplBatch1.id } }),
        prisma.templets.findUnique({ where: { id: tplBatch2.id } }),
      ]);
      assert.strictEqual(r1, null, "Batch 1 must be deleted");
      assert.strictEqual(r2, null, "Batch 2 must be deleted");
      pass("12. Batch delete - multiple templates successfully deleted by owner");
    } catch (err) {
      fail("12. Batch delete by owner", err);
    }

    // 13. Owner successfully deletes primary test template
    try {
      const ownerDelRes = await fetch(`${BASE_URL}/del_templets`, {
        method: "POST",
        headers: headersA,
        body: JSON.stringify({ selected: [createdTplIdA] }),
      });
      assert.strictEqual(ownerDelRes.status, 200);
      const body = await ownerDelRes.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.msg, "Contact(s) was deleted");

      const verifyDeleted = await prisma.templets.findUnique({
        where: { id: createdTplIdA },
      });
      assert.strictEqual(verifyDeleted, null, "Template must be removed from database");
      pass("13. Owner delete - successfully deleted template and verified removed from DB");
    } catch (err) {
      fail("13. Owner delete", err);
    }

    // 14. Verification of legacy dbpromise.query co-existence
    try {
      const rows = await query("SELECT COUNT(*) AS total FROM templets");
      assert(rows && rows.length > 0, "dbpromise.query must return results");
      assert(typeof rows[0].total === "number" || typeof rows[0].total === "bigint", "Total count returned");
      pass("14. Legacy helper co-existence - backend/database/dbpromise.js remains 100% operational");
    } catch (err) {
      fail("14. Legacy helper co-existence", err);
    }

  } catch (globalErr) {
    fail("Global test runner failure", globalErr);
  } finally {
    // Teardown: Clean up any test fixtures that were tracked
    if (cleanupIds.length > 0) {
      try {
        await prisma.templets.deleteMany({
          where: { id: { in: cleanupIds } },
        });
      } catch {}
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await prisma.$disconnect();
  }

  console.log("\n====================================================================");
  console.log(`📊 P2 TEMPLETS TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
