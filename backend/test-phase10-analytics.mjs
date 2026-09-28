import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { query } from './database/dbpromise.js';

const BASE_URL = 'http://localhost:3001/api';
const FRONTEND_URL = 'http://localhost:3000/api';
const JWTKEY = process.env.JWTKEY;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING PHASE 10 VERIFICATION & REGRESSION SUITE');
  console.log('================================================================\n');

  // Find admin and unblocked regular users
  const admins = await query("SELECT uid, email, tokenVersion FROM admin LIMIT 1");
  const users = await query("SELECT uid, email, tokenVersion FROM user WHERE is_blocked = 0 LIMIT 3");

  if (!admins.length || users.length < 2) {
    console.error("Missing admin or users in database for cross-tenant testing.");
    process.exit(1);
  }

  const admin = admins[0];
  const userA = users[0];
  const userB = users[1];

  const adminToken = sign({ uid: admin.uid, role: 'admin', tokenVersion: admin.tokenVersion || 0 }, JWTKEY);
  const userAToken = sign({ uid: userA.uid, role: 'user', tokenVersion: userA.tokenVersion || 0 }, JWTKEY);
  const userBToken = sign({ uid: userB.uid, role: 'user', tokenVersion: userB.tokenVersion || 0 }, JWTKEY);

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const userAHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` };
  const userBHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` };

  // =========================================================================
  // 1. INBOX INSTANCE FILTERING
  // =========================================================================
  console.log('1. Testing Inbox Instance Filter & Cross-Instance Isolation');
  {
    // Find an instance with conversations
    const [instWithChats] = await query(
      `SELECT i.id, i.uid, i.uniqueId, i.number 
       FROM instance i 
       JOIN beta_chats c ON c.uid = i.uid AND c.chat_id LIKE CONCAT(i.number, '_%')
       WHERE i.number IS NOT NULL 
       LIMIT 1`
    );

    if (instWithChats) {
      const ownerToken = sign({ uid: instWithChats.uid, role: 'user', tokenVersion: 0 }, JWTKEY);
      const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

      // 1.1 All instances filter
      const resAll = await fetch(`${BASE_URL}/inbox/get_chats?accountId=all`, { headers: ownerHeaders });
      const dataAll = await resAll.json();
      assert(resAll.status === 200 && dataAll.success === true, 'All instances filter returns HTTP 200 with success: true');
      assert(Array.isArray(dataAll.chats) && dataAll.chats.length > 0, `All instances correctly returns chats (${dataAll.chats.length} found)`);

      // 1.2 Specific instance filter by uniqueId
      const resInstUnique = await fetch(`${BASE_URL}/inbox/get_chats?accountId=${instWithChats.uniqueId}`, { headers: ownerHeaders });
      const dataInstUnique = await resInstUnique.json();
      assert(resInstUnique.status === 200 && dataInstUnique.success === true, 'Specific instance filter (uniqueId) returns HTTP 200');
      assert(dataInstUnique.chats.length > 0, `Specific instance (uniqueId) correctly displays its chats (${dataInstUnique.chats.length} found)`);

      // 1.3 Specific instance filter by primary key ID
      const resInstId = await fetch(`${BASE_URL}/inbox/get_chats?accountId=${instWithChats.id}`, { headers: ownerHeaders });
      const dataInstId = await resInstId.json();
      assert(resInstId.status === 200 && dataInstId.success === true, 'Specific instance filter (numeric ID) returns HTTP 200');
      assert(dataInstId.chats.length > 0, `Specific instance (numeric ID) correctly displays its chats (${dataInstId.chats.length} found)`);

      // 1.4 Unauthorized instance access: User B attempts to access User A's instance
      const resUnauthorized = await fetch(`${BASE_URL}/inbox/get_chats?accountId=${instWithChats.uniqueId}`, { headers: userBHeaders });
      assert(resUnauthorized.status === 403, `Cross-tenant unauthorized instance query rejected with HTTP 403 Forbidden (got ${resUnauthorized.status})`);
      const dataUnauthorized = await resUnauthorized.json();
      assert(dataUnauthorized.success === false, 'Unauthorized response has success: false');

      // 1.5 Non-existent / fake instance
      const resFake = await fetch(`${BASE_URL}/inbox/get_chats?accountId=non_existent_instance_xyz`, { headers: ownerHeaders });
      assert(resFake.status === 403, 'Non-existent instance filter rejected with HTTP 403 Forbidden');
    } else {
      console.log('  ℹ No paired instance with chats found for test 1, testing rejection paths');
      const resFake = await fetch(`${BASE_URL}/inbox/get_chats?accountId=non_existent_instance_xyz`, { headers: userAHeaders });
      assert(resFake.status === 403, 'Non-existent instance filter rejected with HTTP 403 Forbidden');
    }
  }

  // =========================================================================
  // 2. AUTHENTICATION & USER-FACING ALERTS
  // =========================================================================
  console.log('\n2. Testing Authentication Alerts & Feedback');
  {
    // 2.1 Wrong password login
    const wrongPassRes = await fetch(`${FRONTEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: 'this_is_a_deliberately_wrong_password' }),
    });
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401 Unauthorized');
    assert(wrongPassData.success === false, 'Wrong password returns success: false');
    assert(
      wrongPassData.msg && typeof wrongPassData.msg === 'string' && wrongPassData.msg.length > 0,
      `Wrong password exposes clear user-facing error message: "${wrongPassData.msg}"`
    );

    // 2.2 Unregistered user login
    const nonExistentRes = await fetch(`${FRONTEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'non_existent_user_99999@example.com', password: 'somepassword' }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert(nonExistentRes.status === 401, 'Unregistered user returns HTTP 401');
    assert(nonExistentData.msg !== undefined, `Unregistered user returns message: "${nonExistentData.msg}"`);
  }

  // =========================================================================
  // 3. REAL USER WORKSPACE ANALYTICS (/api/user/analytics)
  // =========================================================================
  console.log('\n3. Testing Real User Workspace Analytics (/api/user/analytics)');
  {
    // 3.1 Authenticated access
    const res7d = await fetch(`${BASE_URL}/user/analytics?range=7d`, { headers: userAHeaders });
    const json7d = await res7d.json();
    assert(res7d.status === 200, 'User analytics 7d returns HTTP 200');
    assert(json7d.success === true, 'User analytics 7d returns success: true');
    assert(json7d.data && json7d.data.range === '7d', 'Response contains matching range: 7d');
    assert(Array.isArray(json7d.data.availableInstances), 'Response contains availableInstances array');

    // 3.2 Date ranges: today, yesterday, 30d, 90d
    for (const r of ['today', 'yesterday', '30d', '90d']) {
      const res = await fetch(`${BASE_URL}/user/analytics?range=${r}`, { headers: userAHeaders });
      const json = await res.json();
      assert(res.status === 200 && json.data?.range === r, `Range "${r}" successfully returned HTTP 200`);
    }

    // 3.3 Custom date range
    const resCustom = await fetch(
      `${BASE_URL}/user/analytics?range=custom&startDate=2026-01-01&endDate=2026-09-25`,
      { headers: userAHeaders }
    );
    const jsonCustom = await resCustom.json();
    assert(resCustom.status === 200, 'Custom date range returns HTTP 200');
    assert(jsonCustom.data?.range === 'custom', 'Custom date range echoes range: custom');

    // 3.4 Verification against real database metrics
    const [realContactCount] = await query('SELECT COUNT(*) as count FROM contact WHERE uid = ?', [userA.uid]);
    const [realCampaignCount] = await query(
      'SELECT COUNT(*) as count FROM beta_campaign WHERE uid = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [userA.uid]
    );

    const res30d = await fetch(`${BASE_URL}/user/analytics?range=30d`, { headers: userAHeaders });
    const json30d = await res30d.json();

    assert(
      json30d.data.contacts.total === realContactCount.count,
      `User contacts count matches real database count (${json30d.data.contacts.total} === ${realContactCount.count})`
    );
    assert(
      json30d.data.campaigns.total === realCampaignCount.count,
      `User campaigns count matches real database count (${json30d.data.campaigns.total} === ${realCampaignCount.count})`
    );
    assert(typeof json30d.data.messages.delivered === 'number', 'Delivered message metric is calculated');
    assert(typeof json30d.data.messages.read === 'number', 'Read message metric is calculated');
    assert(Array.isArray(json30d.data.conversations.byOrigin), 'Conversation breakdown by origin is an array');

    // 3.5 Tenant Isolation: User A and User B cannot access each other's data
    const resA = await fetch(`${BASE_URL}/user/analytics?range=30d`, { headers: userAHeaders });
    const resB = await fetch(`${BASE_URL}/user/analytics?range=30d`, { headers: userBHeaders });
    const jsonA = await resA.json();
    const jsonB = await resB.json();

    assert(jsonA.success && jsonB.success, 'Both tenant analytics succeeded');
    // Ensure instances list only contains their own
    const userAInstances = jsonA.data.availableInstances.filter(i => i.id !== 'all');
    const userBInstances = jsonB.data.availableInstances.filter(i => i.id !== 'all');
    const crossContamination = userAInstances.some(ai => userBInstances.some(bi => bi.id === ai.id));
    assert(!crossContamination, 'No cross-tenant instance contamination between User A and User B');
  }

  // =========================================================================
  // 4. ADMIN GOD-EYE PLATFORM ANALYTICS (/api/admin/analytics)
  // =========================================================================
  console.log('\n4. Testing Admin God-Eye Platform Analytics (/api/admin/analytics)');
  {
    // 4.1 Admin access succeeds
    const resAdmin = await fetch(`${BASE_URL}/admin/analytics?range=30d`, { headers: adminHeaders });
    const jsonAdmin = await resAdmin.json();
    assert(resAdmin.status === 200, 'Admin analytics returns HTTP 200 for admin token');
    assert(jsonAdmin.success === true, 'Admin analytics returns success: true');

    // 4.2 Non-admin strictly rejected with HTTP 403 Forbidden
    const resUserDeny = await fetch(`${BASE_URL}/admin/analytics?range=30d`, { headers: userAHeaders });
    assert(
      resUserDeny.status === 403,
      `Regular user is strictly rejected with HTTP 403 Forbidden (got ${resUserDeny.status})`
    );

    // 4.3 Database verification of platform numbers
    const [realUsers] = await query('SELECT COUNT(*) as count FROM user');
    const [realRevenue] = await query(
      "SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) as total FROM orders WHERE status IN ('SUCCESS', 'PAID')"
    );

    assert(
      jsonAdmin.data.users.total === realUsers.count,
      `Platform user count matches DB (${jsonAdmin.data.users.total} === ${realUsers.count})`
    );
    assert(
      Math.abs(jsonAdmin.data.revenue.totalRevenue - parseFloat(realRevenue.total)) < 0.01,
      `Platform revenue matches DB orders ($${jsonAdmin.data.revenue.totalRevenue} === $${realRevenue.total})`
    );

    // 4.4 Structure & Time Series
    assert(Array.isArray(jsonAdmin.data.users.growthTimeSeries), 'Users growth time-series is an array');
    assert(Array.isArray(jsonAdmin.data.revenue.timeSeries), 'Revenue velocity time-series is an array');
    assert(Array.isArray(jsonAdmin.data.throughput.timeSeries), 'Throughput velocity time-series is an array');
    assert(Array.isArray(jsonAdmin.data.auditLogs), 'Platform audit logs stream is an array');
    assert(Array.isArray(jsonAdmin.data.topWorkspaces), 'Top workspaces usage outliers is an array');
  }

  console.log('\n================================================================');
  console.log(`  PHASE 10 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
