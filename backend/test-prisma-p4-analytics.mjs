/**
 * Phase P4 — Analytics & Reporting Verification Suite
 * Verifies that all migrated analytics, aggregations, time-series, and dashboard queries
 * execute via Prisma with strict metric semantics, tenant isolation, and zero regressions.
 */
import assert from "node:assert";
import { prisma, sanitizeBigInt } from "./database/prisma.js";
import { query } from "./database/dbpromise.js";
import {
  buildDateRangeFilter,
  resolveInstanceScope,
  getUserWorkspaceAnalytics,
  getAdminPlatformAnalytics,
} from "./services/analytics/analyticsService.js";
import {
  recordUsageEvent,
  getAggregateUsage,
} from "./services/api/usageService.js";

console.log("====================================================================");
console.log("🧪 PHASE P4 — PRISMA ANALYTICS & REPORTING VERIFICATION SUITE");
console.log("====================================================================\n");

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

async function runSuite() {
  // ─── PART 1: DATE RANGE FILTER CONTRACTS ────────────────────────────────────
  try {
    const todayFilter = buildDateRangeFilter({ range: "today" }, "createdAt");
    assert(todayFilter.conditionSql.includes("CURDATE()"), "today should use CURDATE()");
    assert.strictEqual(todayFilter.params.length, 0);

    const sevenDayFilter = buildDateRangeFilter({ range: "7d" }, "createdAt");
    assert(sevenDayFilter.conditionSql.includes("INTERVAL 7 DAY"), "7d should use INTERVAL 7 DAY");

    const customFilter = buildDateRangeFilter({
      range: "custom",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
    }, "createdAt");
    assert(customFilter.conditionSql.includes("? AND createdAt <= ?"), "custom should use ? placeholders");
    assert.strictEqual(customFilter.params.length, 2);
    assert.strictEqual(customFilter.params[0], "2026-10-01 00:00:00");
    assert.strictEqual(customFilter.params[1], "2026-10-15 23:59:59");

    recordPass("1. Date range filter contracts (today, 7d, custom)");
  } catch (err) {
    recordFail("1. Date range filter contracts", err);
  }

  // ─── PART 2: BIGINT & DECIMAL SANITIZATION ──────────────────────────────────
  try {
    const sample = {
      bigIntValue: 99n,
      arrayBigInt: [1n, 2n, 3n],
      decimalLike: {
        toNumber() { return 123.45; }
      },
      nested: {
        count: 500n,
      },
      normalNum: 42,
      str: "hello",
      dateVal: new Date("2026-10-21T00:00:00Z"),
    };

    const sanitized = sanitizeBigInt(sample);
    assert.strictEqual(typeof sanitized.bigIntValue, "number");
    assert.strictEqual(sanitized.bigIntValue, 99);
    assert.deepStrictEqual(sanitized.arrayBigInt, [1, 2, 3]);
    assert.strictEqual(sanitized.decimalLike, 123.45);
    assert.strictEqual(sanitized.nested.count, 500);
    assert.strictEqual(sanitized.normalNum, 42);
    assert.strictEqual(sanitized.str, "hello");
    assert(sanitized.dateVal instanceof Date);

    const json = JSON.stringify(sanitized);
    assert(typeof json === "string");
    recordPass("2. BigInt & Prisma.Decimal recursion sanitizer");
  } catch (err) {
    recordFail("2. BigInt & Prisma.Decimal recursion sanitizer", err);
  }

  // ─── PART 3: TENANT ISOLATION IN INSTANCE SCOPING ───────────────────────────
  try {
    // Non-existent or other tenant instance must reject with 403
    let threw403 = false;
    try {
      await resolveInstanceScope("fake_user_uid_12345", "unauthorized_inst_99999");
    } catch (err) {
      if (err.statusCode === 403) threw403 = true;
    }
    assert(threw403, "resolveInstanceScope must throw 403 for unauthorized instances");

    const unscoped = await resolveInstanceScope("fake_user_uid_12345", "all");
    assert.strictEqual(unscoped.isScoped, false);

    recordPass("3. Tenant isolation in WhatsApp instance resolution");
  } catch (err) {
    recordFail("3. Tenant isolation in WhatsApp instance resolution", err);
  }

  // ─── PART 4: USER WORKSPACE ANALYTICS (NON-EXISTENT WORKSPACE) ──────────────
  try {
    const resEmpty = await getUserWorkspaceAnalytics("nonexistent_workspace_uid", { range: "30d" });

    assert.strictEqual(resEmpty.messages.total, 0);
    assert.strictEqual(resEmpty.messages.incoming, 0);
    assert.strictEqual(resEmpty.conversations.total, 0);
    assert.strictEqual(resEmpty.contacts.total, 0);
    assert.strictEqual(resEmpty.campaigns.total, 0);
    assert.strictEqual(resEmpty.automations.totalFlows, 0);
    assert.strictEqual(resEmpty.usage.planTitle, "Free Tier");
    assert(!isNaN(resEmpty.conversations.totalUnread), "totalUnread must not be NaN");

    const serialized = JSON.stringify(resEmpty);
    assert(serialized.length > 0);
    recordPass("4. User workspace analytics empty boundary handling");
  } catch (err) {
    recordFail("4. User workspace analytics empty boundary handling", err);
  }

  // ─── PART 5: USER WORKSPACE ANALYTICS (REAL WORKSPACE) ───────────────────────
  try {
    // Find an existing user from the database
    const sampleUser = await prisma.user.findFirst({
      select: { uid: true, name: true },
    });
    assert(sampleUser, "Database should have at least 1 user");

    const resUser = await getUserWorkspaceAnalytics(sampleUser.uid, { range: "30d" });
    assert(typeof resUser.messages.total === "number");
    assert(Array.isArray(resUser.messages.timeSeries));
    assert(Array.isArray(resUser.conversations.byOrigin));
    assert(Array.isArray(resUser.contacts.byPhonebook));
    assert(Array.isArray(resUser.availableInstances));
    assert(Array.isArray(resUser.campaigns.recent));
    assert(!isNaN(resUser.usage.contacts.used));
    assert(!isNaN(resUser.usage.qrAccounts.used));

    recordPass("5. User workspace analytics real tenant metrics", `UID: ${sampleUser.uid}`);
  } catch (err) {
    recordFail("5. User workspace analytics real tenant metrics", err);
  }

  // ─── PART 6: ADMIN PLATFORM ANALYTICS ───────────────────────────────────────
  try {
    const adminAnalytics = await getAdminPlatformAnalytics({ range: "30d" });

    // Assert user statistics
    assert(typeof adminAnalytics.users.total === "number");
    assert(adminAnalytics.users.total > 0, "Platform total users should be > 0");
    assert(!isNaN(adminAnalytics.users.active));
    assert(!isNaN(adminAnalytics.users.blocked));
    assert(Array.isArray(adminAnalytics.users.growthTimeSeries));
    assert(Array.isArray(adminAnalytics.users.planDistribution));

    // Assert revenue statistics
    assert(typeof adminAnalytics.revenue.totalRevenue === "number");
    assert(!isNaN(adminAnalytics.revenue.totalRevenue), "totalRevenue must not be NaN");
    assert(!isNaN(adminAnalytics.revenue.periodRevenue), "periodRevenue must not be NaN");
    assert(typeof adminAnalytics.revenue.totalOrders === "number");
    assert(Array.isArray(adminAnalytics.revenue.timeSeries));

    // Assert WhatsApp platform stats
    assert(!isNaN(adminAnalytics.whatsapp.total));
    assert(!isNaN(adminAnalytics.whatsapp.active));

    // Assert throughput metrics
    assert(!isNaN(adminAnalytics.throughput.messagesInPeriod));
    assert(!isNaN(adminAnalytics.throughput.campaignDispatches));
    assert(!isNaN(adminAnalytics.throughput.totalFlows));
    assert(adminAnalytics.throughput.totalFlows > 0, "Platform total flows should be > 0");
    assert(Array.isArray(adminAnalytics.throughput.timeSeries));

    // Assert top workspaces
    assert(Array.isArray(adminAnalytics.topWorkspaces));
    assert(adminAnalytics.topWorkspaces.length <= 5);

    // Verify JSON serialization
    const serializedAdmin = JSON.stringify(adminAnalytics);
    assert(serializedAdmin.length > 0);

    recordPass(
      "6. Admin platform analytics (God-Eye platform rollups)",
      `Users: ${adminAnalytics.users.total}, Revenue: ${adminAnalytics.revenue.totalRevenue}, Flows: ${adminAnalytics.throughput.totalFlows}`
    );
  } catch (err) {
    recordFail("6. Admin platform analytics", err);
  }

  // ─── PART 7: USAGE SERVICE (RECORD & AGGREGATE) ─────────────────────────────
  const testUid = `test_analytics_user_${Date.now()}`;
  try {
    // 1. Record usage event via Prisma
    await recordUsageEvent({
      uid: testUid,
      apiKeyId: null,
      connectionPublicId: "conn_test_public",
      endpoint: "/v1/messages",
      method: "POST",
      statusCode: 200,
      messageId: "msg_test_123",
      messageStatus: "delivered",
      durationMs: 45,
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await getAggregateUsage(testUid, currentMonth);

    assert.strictEqual(usage.period, currentMonth);
    assert(usage.api_requests >= 1, "api_requests should be at least 1");
    assert(usage.messages.delivered >= 1, "delivered count should be at least 1");
    assert(!isNaN(usage.messages.accepted));
    assert(!isNaN(usage.messages.failed));

    recordPass("7. API usage event logging & monthly aggregation", `Requests: ${usage.api_requests}, Delivered: ${usage.messages.delivered}`);
  } catch (err) {
    recordFail("7. API usage event logging & monthly aggregation", err);
  } finally {
    // Cleanup recorded test event
    await prisma.api_usage_events.deleteMany({
      where: { uid: testUid },
    });
  }

  // ─── PART 8: USER DASHBOARD AGGREGATION QUERIES ─────────────────────────────
  try {
    const userSample = await prisma.user.findFirst();
    const uid = userSample.uid;

    const [agentsCount, activeChatsCount, completedTasksCount, activeInstancesCount] =
      await Promise.all([
        prisma.agents.count({ where: { owner_uid: uid } }),
        prisma.beta_chats.count({ where: { uid, unread_count: { gt: 0 } } }),
        prisma.agent_task.count({ where: { owner_uid: uid, status: "COMPLETED" } }),
        prisma.instance.count({ where: { uid, status: "ACTIVE" } }),
      ]);

    assert(typeof agentsCount === "number");
    assert(typeof activeChatsCount === "number");
    assert(typeof completedTasksCount === "number");
    assert(typeof activeInstancesCount === "number");

    const rawPerformanceData = await prisma.$queryRaw`
      SELECT
        DATE(createdAt) as date,
        COUNT(CASE WHEN route = 'INCOMING' THEN 1 END) as incoming,
        COUNT(CASE WHEN route = 'OUTGOING' THEN 1 END) as outgoing
      FROM beta_conversation
      WHERE uid = ${uid} AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `;
    const performanceData = sanitizeBigInt(rawPerformanceData);
    assert(Array.isArray(performanceData));

    recordPass("8. User dashboard aggregates (counts & 7-day conversation performance)");
  } catch (err) {
    recordFail("8. User dashboard aggregates", err);
  }

  // ─── PART 9: BROADCAST DASHBOARD AGGREGATION QUERIES ─────────────────────────
  try {
    const userSample = await prisma.user.findFirst();
    const uid = userSample.uid;

    const totalCampaigns = await prisma.beta_campaign.count({ where: { uid } });
    assert(typeof totalCampaigns === "number");

    const rawMessageStats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN delivery_status = 'read' THEN 1 ELSE 0 END) as \`read\`,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
      FROM beta_campaign_logs
      WHERE uid = ${uid}
    `;
    const messageStats = sanitizeBigInt(rawMessageStats);
    assert(Array.isArray(messageStats));
    assert(!isNaN(parseInt(messageStats[0]?.total || 0, 10)));
    assert(!isNaN(parseInt(messageStats[0]?.delivered || 0, 10)));

    const rawDailyStats = await prisma.$queryRaw`
      SELECT
        DATE(l.createdAt) as date,
        COUNT(*) as total_messages,
        SUM(CASE WHEN l.status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN l.delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN l.delivery_status = 'read' THEN 1 ELSE 0 END) as \`read\`,
        SUM(CASE WHEN l.status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM beta_campaign_logs l
      WHERE l.uid = ${uid}
      AND l.createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(l.createdAt)
      ORDER BY date DESC
    `;
    const dailyStats = sanitizeBigInt(rawDailyStats);
    assert(Array.isArray(dailyStats));

    recordPass("9. Broadcast dashboard aggregates (campaigns, message status, daily breakdown)");
  } catch (err) {
    recordFail("9. Broadcast dashboard aggregates", err);
  }

  // ─── PART 10: ADMIN USAGE SUMMARY (CORRELATED SUBQUERIES) ───────────────────
  try {
    const rawTenants = await prisma.$queryRaw`
      SELECT
        u.id, u.uid, u.name, u.email, u.plan, u.plan_expire,
        (SELECT COUNT(*) FROM contact c WHERE c.uid = u.uid) as contactCount,
        (SELECT COUNT(*) FROM instance i WHERE i.uid = u.uid) as instanceCount,
        (SELECT COUNT(*) FROM beta_chatbot b WHERE b.uid = u.uid AND b.active = 1) as activeChatbots,
        (SELECT COUNT(*) FROM beta_campaign bc WHERE bc.uid = u.uid) as campaignCount
      FROM user u
      WHERE u.is_blocked = 0 OR u.is_blocked IS NULL
      ORDER BY contactCount DESC
      LIMIT 10
    `;
    const tenants = sanitizeBigInt(rawTenants);
    assert(Array.isArray(tenants));
    assert(tenants.length > 0);
    assert(typeof tenants[0].contactCount === "number");
    assert(typeof tenants[0].instanceCount === "number");
    assert(typeof tenants[0].activeChatbots === "number");
    assert(typeof tenants[0].campaignCount === "number");

    recordPass("10. Admin God-mode usage summary (correlated subqueries)");
  } catch (err) {
    recordFail("10. Admin God-mode usage summary", err);
  }

  // ─── PART 11: LEGACY QUERY HELPER INTEGRITY ─────────────────────────────────
  try {
    const legacyResult = await query("SELECT 1 + 1 AS sum");
    assert(Array.isArray(legacyResult));
    assert.strictEqual(legacyResult[0].sum, 2);
    recordPass("11. Legacy query helper (backend/database/dbpromise.js) intact and operational");
  } catch (err) {
    recordFail("11. Legacy query helper integrity", err);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n====================================================================");
  console.log(`📊 PHASE P4 ANALYTICS TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
