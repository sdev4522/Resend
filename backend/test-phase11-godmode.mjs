import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { query } from './database/dbpromise.js';

const BASE_URL = 'http://localhost:3001/api';
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

async function runPhase11Tests() {
  console.log('================================================================');
  console.log('  STARTING PHASE 11 GOD-MODE ADMIN AUTOMATED VERIFICATION');
  console.log('================================================================\n');

  const admins = await query("SELECT uid, email, tokenVersion FROM admin LIMIT 1");
  const users = await query("SELECT uid, email, tokenVersion FROM user WHERE is_blocked = 0 LIMIT 2");

  if (!admins.length || users.length < 1) {
    console.error("Missing admin or users in database.");
    process.exit(1);
  }

  const admin = admins[0];
  const user = users[0];

  const adminToken = sign({ uid: admin.uid, role: 'admin', tokenVersion: admin.tokenVersion || 0 }, JWTKEY);
  const userToken = sign({ uid: user.uid, role: 'user', tokenVersion: user.tokenVersion || 0 }, JWTKEY);

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const userHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` };

  // =========================================================================
  // 1. RBAC SECURITY CHECKS (User must be rejected from Admin endpoints)
  // =========================================================================
  console.log('1. Verifying Server-Side RBAC Enforcement (401/403 for Non-Admin)');
  {
    const endpoints = [
      '/admin/get_workspaces',
      '/admin/get_all_instances',
      '/admin/get_subscriptions',
      '/admin/get_usage_summary',
      '/admin/get_audit_logs',
      '/admin/analytics?range=30d',
      '/admin/get_payment_orders',
    ];

    for (const ep of endpoints) {
      // Unauthenticated
      const resUnauth = await fetch(`${BASE_URL}${ep}`);
      assert(resUnauth.status === 401 || resUnauth.status === 403, `Unauthenticated blocked on ${ep} (${resUnauth.status})`);

      // Regular User Token
      const resUser = await fetch(`${BASE_URL}${ep}`, { headers: userHeaders });
      assert(resUser.status === 401 || resUser.status === 403, `User role denied on ${ep} (${resUser.status})`);

      // Admin Token
      const resAdmin = await fetch(`${BASE_URL}${ep}`, { headers: adminHeaders });
      assert(resAdmin.status === 200, `Admin role permitted on ${ep} (${resAdmin.status})`);
    }
  }

  // =========================================================================
  // 2. GOD-MODE OVERVIEW ANALYTICS TELEMETRY
  // =========================================================================
  console.log('\n2. Verifying Real Database Analytics Telemetry');
  {
    const res = await fetch(`${BASE_URL}/admin/analytics?range=30d`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Analytics endpoint returned success');
    assert(typeof json.data?.users?.total === 'number' && json.data.users.total > 0, `Users total is accurate (${json.data?.users?.total})`);
    assert(typeof json.data?.whatsapp?.total === 'number', `WhatsApp total count present (${json.data?.whatsapp?.total})`);
    assert(typeof json.data?.revenue?.totalRevenue === 'number', `Total revenue present ($${json.data?.revenue?.totalRevenue})`);
    assert(Array.isArray(json.data?.revenue?.timeSeries), 'Revenue time-series is array');
    assert(Array.isArray(json.data?.users?.planDistribution), 'Plan distribution is array');
  }

  // =========================================================================
  // 3. WORKSPACES RETRIEVAL & PAGINATION
  // =========================================================================
  console.log('\n3. Verifying Workspaces Management & Quotas');
  {
    const res = await fetch(`${BASE_URL}/admin/get_workspaces?limit=10&offset=0`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Workspaces endpoint returned success');
    assert(Array.isArray(json.data), 'Workspaces list is array');
    assert(json.pagination && json.pagination.total > 0, `Total workspaces count > 0 (${json.pagination?.total})`);
    
    const sampleWs = json.data[0];
    assert(sampleWs && sampleWs.uid && sampleWs.name, `Sample workspace has UID and Name (${sampleWs?.name})`);
    assert(typeof sampleWs.stats?.members === 'number', 'Workspace stats.members present');
    assert(typeof sampleWs.stats?.totalInstances === 'number', 'Workspace stats.totalInstances present');
    assert(typeof sampleWs.stats?.contacts === 'number', 'Workspace stats.contacts present');
  }

  // =========================================================================
  // 4. WHATSAPP FLEET (QR + META) RETRIEVAL & FILTERING
  // =========================================================================
  console.log('\n4. Verifying WhatsApp Fleet Management');
  {
    const res = await fetch(`${BASE_URL}/admin/get_all_instances`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Fleet endpoint returned success');
    assert(Array.isArray(json.data), 'Instances list is array');
    assert(json.summary && typeof json.summary.total === 'number', `Fleet summary total present (${json.summary?.total})`);
    assert(typeof json.summary.activeCount === 'number', `Active count present (${json.summary?.activeCount})`);
  }

  // =========================================================================
  // 5. SUBSCRIPTIONS INSPECTOR
  // =========================================================================
  console.log('\n5. Verifying SaaS Subscriptions Inspector');
  {
    const res = await fetch(`${BASE_URL}/admin/get_subscriptions`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Subscriptions endpoint returned success');
    assert(Array.isArray(json.data), 'Subscriptions list is array');
    assert(json.summary && typeof json.summary.total === 'number', `Subscriptions summary present (${json.summary?.total})`);
    if (json.data.length > 0) {
      const sub = json.data[0];
      assert(sub.uid && sub.userName && sub.planTitle, `Subscription item properly structured (${sub.userName} - ${sub.planTitle})`);
      assert(['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(sub.status), `Subscription status valid (${sub.status})`);
    }
  }

  // =========================================================================
  // 6. USAGE & LIMITS MONITOR
  // =========================================================================
  console.log('\n6. Verifying Usage & Limits Summary');
  {
    const res = await fetch(`${BASE_URL}/admin/get_usage_summary`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Usage summary endpoint returned success');
    assert(Array.isArray(json.data), 'Usage items is array');
    assert(json.summary && typeof json.summary.totalInspected === 'number', `Total inspected present (${json.summary?.totalInspected})`);
    if (json.data.length > 0) {
      const tenant = json.data[0];
      assert(typeof tenant.contacts?.percent === 'number', `Contacts percent calculated (${tenant.contacts?.percent}%)`);
      assert(['NORMAL', 'NEAR_LIMIT', 'LIMIT_REACHED'].includes(tenant.usageRisk), `Usage risk valid (${tenant.usageRisk})`);
    }
  }

  // =========================================================================
  // 7. AUDIT LOGGING & ACTIVITY RECORDING
  // =========================================================================
  console.log('\n7. Verifying Immutable Admin Audit Logs');
  {
    // Toggle user status to generate audit log
    const toggleRes = await fetch(`${BASE_URL}/admin/toggle_user_status`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ uid: user.uid, is_blocked: true }),
    });
    const toggleJson = await toggleRes.json();
    assert(toggleJson.success === true, 'User status toggle succeeded');

    // Fetch audit logs and ensure the event is logged
    const logsRes = await fetch(`${BASE_URL}/admin/get_audit_logs`, { headers: adminHeaders });
    const logsJson = await logsRes.json();
    assert(logsJson.success === true, 'Audit logs endpoint returned success');
    assert(Array.isArray(logsJson.data) && logsJson.data.length > 0, `Audit logs present (${logsJson.data?.length})`);

    const latest = logsJson.data[0];
    assert(latest.action === 'USER_BLOCK', `Latest audit action logged correctly (${latest.action})`);
    assert(latest.target_id === user.uid, `Audit log target_id matches user UID (${latest.target_id})`);

    // Restore user status
    await fetch(`${BASE_URL}/admin/toggle_user_status`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ uid: user.uid, is_blocked: false }),
    });
  }

  // =========================================================================
  // 8. PAYMENT LOGS INSPECTION
  // =========================================================================
  console.log('\n8. Verifying Payment Orders & Logs');
  {
    const res = await fetch(`${BASE_URL}/admin/get_payment_orders`, { headers: adminHeaders });
    const json = await res.json();
    assert(json.success === true, 'Payment orders returned success');
    assert(Array.isArray(json.orders), `Orders is array with ${json.orders?.length} records`);
  }

  console.log('\n================================================================');
  console.log(`  PHASE 11 GOD-MODE ADMIN TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase11Tests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
