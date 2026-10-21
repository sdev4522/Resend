/**
 * Read-Only Prisma Foundation Health & Verification Suite
 * Phase: P1 — Prisma Foundation
 * Verifies non-destructive read connectivity to MariaDB via @prisma/adapter-mariadb.
 */
import assert from "node:assert";
import { prisma } from "./database/prisma.js";

console.log("====================================================================");
console.log("🧪 PRISMA FOUNDATION READ-ONLY HEALTH & VERIFICATION SUITE");
console.log("====================================================================\n");

async function runHealthCheck() {
  let passed = 0;
  let failed = 0;

  function recordPass(testName, details = "") {
    console.log(`✅ [PASS] ${testName}${details ? " -> " + details : ""}`);
    passed++;
  }

  function recordFail(testName, err) {
    console.error(`❌ [FAIL] ${testName}:`, err.message || err);
    failed++;
  }

  try {
    // 1. Database Connection & Plan Model
    try {
      const plans = await prisma.plan.findMany({
        select: { id: true, title: true, price: true, is_trial: true },
        orderBy: { id: "asc" },
      });
      assert(Array.isArray(plans), "Plans should be an array");
      assert(plans.length > 0, "Plans table should contain at least 1 plan");
      recordPass("1. Read plans table", `Found ${plans.length} plans: ${plans.map(p => p.title).join(", ")}`);
    } catch (err) {
      recordFail("1. Read plans table", err);
    }

    // 2. Relation Introspection & Verification (plan_prices -> plan)
    try {
      const planPrices = await prisma.plan_prices.findMany({
        take: 5,
        include: { plan: { select: { title: true } } },
      });
      assert(Array.isArray(planPrices), "Plan prices should be an array");
      if (planPrices.length > 0) {
        assert(planPrices[0].plan, "Physical relation plan_prices -> plan should be populated");
        recordPass("2. Physical foreign key relation (plan_prices -> plan)", `Resolved relation to plan "${planPrices[0].plan.title}"`);
      } else {
        recordPass("2. Physical foreign key relation (plan_prices -> plan)", "0 rows in plan_prices, relation model valid");
      }
    } catch (err) {
      recordFail("2. Physical foreign key relation (plan_prices -> plan)", err);
    }

    // 3. Admin Account Read
    try {
      const admin = await prisma.admin.findFirst({
        select: { id: true, email: true, role: true },
      });
      assert(admin, "Admin record should exist");
      recordPass("3. Read admin table", `Admin ID ${admin.id}, role: ${admin.role}`);
    } catch (err) {
      recordFail("3. Read admin table", err);
    }

    // 4. User Model Read
    try {
      const userCount = await prisma.user.count();
      assert(typeof userCount === "number", "User count should be a number");
      recordPass("4. Read user table count", `Total users in database: ${userCount}`);
    } catch (err) {
      recordFail("4. Read user table count", err);
    }

    // 5. Phase P2 Target Model (templets table)
    try {
      const templetsCount = await prisma.templets.count();
      assert(typeof templetsCount === "number", "Templets count should be a number");
      recordPass("5. Read Phase P2 candidate (templets table)", `Total templets in database: ${templetsCount}`);
    } catch (err) {
      recordFail("5. Read Phase P2 candidate (templets table)", err);
    }

    // 6. Orders & Financial Records Read (Read-Only)
    try {
      const orderCount = await prisma.orders.count();
      assert(typeof orderCount === "number", "Orders count should be a number");
      recordPass("6. Read orders table count", `Total historical orders: ${orderCount}`);
    } catch (err) {
      recordFail("6. Read orders table count", err);
    }

    // 7. Processed Webhook Events (String Primary Key event_id)
    try {
      const webhookEventsCount = await prisma.processed_webhook_events.count();
      assert(typeof webhookEventsCount === "number", "Webhook events count should be a number");
      recordPass("7. Read processed_webhook_events (String PK)", `Total webhook events: ${webhookEventsCount}`);
    } catch (err) {
      recordFail("7. Read processed_webhook_events (String PK)", err);
    }

    // 8. Public API Key Table
    try {
      const apiKeyCount = await prisma.api_keys.count();
      assert(typeof apiKeyCount === "number", "API keys count should be a number");
      recordPass("8. Read api_keys table count", `Total API keys: ${apiKeyCount}`);
    } catch (err) {
      recordFail("8. Read api_keys table count", err);
    }

    // 9. Composite Unique Index Model (auth table)
    try {
      const authCount = await prisma.auth.count();
      assert(typeof authCount === "number", "Auth count should be a number");
      recordPass("9. Read composite unique model (auth table)", `Total auth session entries: ${authCount}`);
    } catch (err) {
      recordFail("9. Read composite unique model (auth table)", err);
    }

    // 10. Clean Disconnection
    await prisma.$disconnect();
    recordPass("10. Disconnect lifecycle", "Prisma client disconnected cleanly without error");

  } catch (globalErr) {
    recordFail("Global test runner failure", globalErr);
  }

  console.log("\n====================================================================");
  console.log(`📊 PRISMA HEALTH RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHealthCheck();
