import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { query } from './database/dbpromise.js';
import randomstring from 'randomstring';

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

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING WACRM ANALYTICS, ADMIN GOD MODE & NOTIFICATIONS SUITE');
  console.log('================================================================\n');

  // Find admin and regular user
  const admins = await query("SELECT uid, email, tokenVersion FROM admin LIMIT 1");
  const users = await query("SELECT uid, email, tokenVersion, is_blocked FROM user LIMIT 2");

  if (!admins.length || !users.length) {
    console.error("Missing admin or users in database.");
    process.exit(1);
  }

  const admin = admins[0];
  const user = users[0];

  const adminToken = sign({ uid: admin.uid, role: 'admin', tokenVersion: admin.tokenVersion || 0 }, JWTKEY);
  const userToken = sign({ uid: user.uid, role: 'user', tokenVersion: user.tokenVersion || 0 }, JWTKEY);

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const userHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` };

  // ----------------------------------------------------
  // 1. User Analytics Endpoint
  // ----------------------------------------------------
  console.log('1. Testing Real User Analytics Endpoint (/api/user/analytics)');
  {
    const res = await fetch(`${BASE_URL}/user/analytics?range=30d`, { headers: userHeaders });
    const json = await res.json();

    assert(res.status === 200, 'User analytics returned HTTP 200');
    assert(json.success === true, 'User analytics returned success: true');
    assert(json.data && json.data.messages !== undefined, 'User analytics contains messages metrics');
    assert(Array.isArray(json.data.messages.timeSeries), 'User analytics contains messages timeSeries array');
    assert(json.data.contacts && typeof json.data.contacts.total === 'number', 'User analytics contains real contacts count');
    assert(json.data.usage && json.data.usage.contacts !== undefined, 'User analytics contains plan usage metrics');
  }

  // ----------------------------------------------------
  // 2. User In-App Notifications
  // ----------------------------------------------------
  console.log('\n2. Testing User In-App Notification Center');
  {
    // Insert a test notification for the user
    await query(
      `INSERT INTO in_app_notifications (uid, title, message, type, action_url, is_read) 
       VALUES (?, 'Test Notification', 'This is a test notification', 'INFO', '/dashboard', 0)`,
      [user.uid]
    );

    const res = await fetch(`${BASE_URL}/user/notifications`, { headers: userHeaders });
    const json = await res.json();

    assert(res.status === 200, 'Notifications endpoint returned HTTP 200');
    assert(json.success === true, 'Notifications returned success: true');
    assert(Array.isArray(json.data), 'Notifications data is an array');
    assert(json.unreadCount >= 1, `Unread count is correct (got ${json.unreadCount})`);

    const testNotif = json.data.find(n => n.title === 'Test Notification');
    assert(testNotif !== undefined, 'Found inserted test notification');

    // Mark as read
    if (testNotif) {
      const markRes = await fetch(`${BASE_URL}/user/mark_notification_read`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ id: testNotif.id }),
      });
      const markJson = await markRes.json();
      assert(markJson.success === true, 'Marked single notification as read');
    }

    // Mark all as read
    const markAllRes = await fetch(`${BASE_URL}/user/mark_notification_read`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ all: true }),
    });
    const markAllJson = await markAllRes.json();
    assert(markAllJson.success === true, 'Marked all notifications as read');
  }

  // ----------------------------------------------------
  // 3. Admin Platform Analytics (God Mode)
  // ----------------------------------------------------
  console.log('\n3. Testing Admin Platform Analytics (/api/admin/analytics)');
  {
    const res = await fetch(`${BASE_URL}/admin/analytics?range=30d`, { headers: adminHeaders });
    const json = await res.json();
    if (!json.success) {
      console.log('Admin analytics error response:', json);
    }

    assert(res.status === 200, 'Admin analytics returned HTTP 200');
    assert(json.success === true, 'Admin analytics returned success: true');
    assert(json.data && json.data.users && typeof json.data.users.total === 'number', 'Platform users total is calculated');
    assert(json.data.revenue && typeof json.data.revenue.totalRevenue === 'number', 'Platform revenue is calculated from orders');
    assert(Array.isArray(json.data.revenue.timeSeries), 'Platform revenue has time series array');
    assert(Array.isArray(json.data.users.growthTimeSeries), 'Platform user growth has time series array');
    assert(Array.isArray(json.data.users.planDistribution), 'Platform plan distribution array exists');
  }

  // ----------------------------------------------------
  // 4. Admin User Inspector Details
  // ----------------------------------------------------
  console.log('\n4. Testing Admin User Inspector (/api/admin/get_user_details)');
  {
    const res = await fetch(`${BASE_URL}/admin/get_user_details?uid=${user.uid}`, { headers: adminHeaders });
    const json = await res.json();

    assert(res.status === 200, 'User inspector returned HTTP 200');
    assert(json.success === true, 'User inspector returned success: true');
    assert(json.data.user && json.data.user.email === user.email, 'Inspector returned matching user profile');
    assert(json.data.stats && typeof json.data.stats.contactsCount === 'number', 'Inspector returned calculated statistics');
    assert(Array.isArray(json.data.instances), 'Inspector returned instances array');
    assert(Array.isArray(json.data.recentOrders), 'Inspector returned recent orders array');
  }

  // ----------------------------------------------------
  // 5. Admin Security: SMTP Masking & Orders Password Privacy
  // ----------------------------------------------------
  console.log('\n5. Testing Admin Security & Secrets Protection');
  {
    // SMTP Password Masking
    const smtpRes = await fetch(`${BASE_URL}/admin/get_smtp`, { headers: adminHeaders });
    const smtpJson = await smtpRes.json();
    assert(smtpJson.success === true, 'get_smtp returned success');
    if (smtpJson.data?.password) {
      assert(
        smtpJson.data.password === '••••••••••••',
        `SMTP password is masked with bullets (got: ${smtpJson.data.password})`
      );
    }

    // Orders Password Leak Prevention
    const ordersRes = await fetch(`${BASE_URL}/admin/get_orders`, { headers: adminHeaders });
    const ordersJson = await ordersRes.json();
    assert(ordersJson.success === true, 'get_orders returned success');
    if (ordersJson.data && ordersJson.data.length > 0) {
      const leakedPassword = ordersJson.data.some((o) => o.password !== undefined);
      assert(!leakedPassword, 'Verified orders query does NOT leak user password hashes');
    }

    // Users List Password Hash Prevention
    const usersRes = await fetch(`${BASE_URL}/admin/get_users`, { headers: adminHeaders });
    const usersJson = await usersRes.json();
    assert(usersJson.success === true, 'get_users returned success');
    if (usersJson.data && usersJson.data.length > 0) {
      const leakedUserPass = usersJson.data.some((u) => u.password !== undefined);
      assert(!leakedUserPass, 'Verified get_users does NOT leak user password hashes');
      const hasIsBlocked = usersJson.data.some((u) => u.is_blocked !== undefined);
      assert(hasIsBlocked, 'Verified get_users includes is_blocked column');
    }
  }

  // ----------------------------------------------------
  // 6. User Account Block & Session Revocation Enforcement
  // ----------------------------------------------------
  console.log('\n6. Testing Account Blocking & Real-time Session Enforcement');
  {
    // Create a temporary test user to block/unblock
    const testEmail = `block_test_${randomstring.generate(8)}@example.com`;
    const testUid = `test_uid_${randomstring.generate(12)}`;

    await query(
      `INSERT INTO user (uid, name, email, password, role, is_blocked, tokenVersion) 
       VALUES (?, 'Block Test', ?, 'hashedpassword', 'user', 0, 1)`,
      [testUid, testEmail]
    );

    let testUserToken = sign({ uid: testUid, role: 'user', tokenVersion: 1 }, JWTKEY);
    let testUserHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${testUserToken}` };

    // Request should work when not blocked
    const preBlockRes = await fetch(`${BASE_URL}/user/analytics?range=today`, { headers: testUserHeaders });
    assert(preBlockRes.status === 200, 'Unblocked user request succeeds with HTTP 200');

    // Admin blocks the user
    const blockRes = await fetch(`${BASE_URL}/admin/toggle_user_status`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ uid: testUid, is_blocked: true }),
    });
    const blockJson = await blockRes.json();
    assert(blockJson.success === true, 'Admin toggle_user_status succeeded');
    assert(blockJson.is_blocked === 1, 'is_blocked is now 1 in response');

    // Immediately after block: the user's token should be rejected with 403 Forbidden!
    const postBlockRes = await fetch(`${BASE_URL}/user/analytics?range=today`, { headers: testUserHeaders });
    assert(
      postBlockRes.status === 403,
      `Blocked user request is strictly rejected with HTTP 403 Forbidden (got: ${postBlockRes.status})`
    );

    // Admin unblocks the user
    const unblockRes = await fetch(`${BASE_URL}/admin/toggle_user_status`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ uid: testUid, is_blocked: false }),
    });
    const unblockJson = await unblockRes.json();
    assert(unblockJson.success === true, 'Admin unblocked user');
    assert(unblockJson.is_blocked === 0, 'is_blocked is now 0');

    // User gets a new token and request succeeds
    const [freshUserRow] = await query('SELECT tokenVersion FROM user WHERE uid = ?', [testUid]);
    testUserToken = sign({ uid: testUid, role: 'user', tokenVersion: freshUserRow.tokenVersion }, JWTKEY);
    testUserHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${testUserToken}` };

    const postUnblockRes = await fetch(`${BASE_URL}/user/analytics?range=today`, { headers: testUserHeaders });
    assert(postUnblockRes.status === 200, 'Unblocked user with fresh token succeeds with HTTP 200');

    // Cleanup test user
    await query('DELETE FROM user WHERE uid = ?', [testUid]);
  }

  // ----------------------------------------------------
  // 7. Admin Broadcast Notification
  // ----------------------------------------------------
  console.log('\n7. Testing Multi-channel Notification Broadcast');
  {
    const broadcastRes = await fetch(`${BASE_URL}/admin/send_notification`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Platform Maintenance Notice',
        message: 'System upgrade in progress.',
        channels: ['in_app'],
        audience_type: 'single',
        target_uids: [user.uid],
        action_url: '/dashboard',
      }),
    });
    const broadcastJson = await broadcastRes.json();
    assert(broadcastRes.status === 200, 'send_notification returned HTTP 200');
    assert(broadcastJson.success === true, 'send_notification returned success: true');
    assert(broadcastJson.data?.sentCount >= 1, 'Broadcast registered sentCount >= 1');

    // Verify broadcast history was recorded
    const historyRes = await fetch(`${BASE_URL}/admin/notification_history`, { headers: adminHeaders });
    const historyJson = await historyRes.json();
    assert(historyJson.success === true, 'notification_history returned success: true');
    assert(Array.isArray(historyJson.data) && historyJson.data.length > 0, 'Broadcast history contains logged events');
  }

  // ----------------------------------------------------
  // 8. Mail Templates CRUD & Preview
  // ----------------------------------------------------
  console.log('\n8. Testing Mail Templates CRUD & Variable Interpolation');
  {
    // Create template
    const tplName = `test_tpl_${randomstring.generate(6).toLowerCase()}`;
    const saveRes = await fetch(`${BASE_URL}/admin/save_mail_template`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: tplName,
        subject: 'Hello {{name}}, welcome to {{app_name}}!',
        body: '<h1>Welcome {{name}}!</h1><p>Your plan is {{plan}}.</p>',
      }),
    });
    const saveJson = await saveRes.json();
    assert(saveJson.success === true, `Created email template "${tplName}"`);

    // Preview template
    const previewRes = await fetch(`${BASE_URL}/admin/preview_mail_template`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        subject: 'Hello {{name}}!',
        body: '<p>Plan: {{plan}}, App: {{app_name}}</p>',
      }),
    });
    const previewJson = await previewRes.json();
    assert(previewJson.success === true, 'Preview template returned success: true');
    assert(
      previewJson.data.renderedSubject.includes('Alex Mercer') || !previewJson.data.renderedSubject.includes('{{name}}'),
      'Variables interpolated in subject line'
    );
    assert(
      !previewJson.data.renderedBody.includes('{{app_name}}'),
      'Variables interpolated in template body'
    );

    // List templates
    const listRes = await fetch(`${BASE_URL}/admin/mail_templates`, { headers: adminHeaders });
    const listJson = await listRes.json();
    assert(listJson.success === true, 'mail_templates returned success: true');
    const createdTpl = listJson.data?.find((t) => t.name === tplName);
    assert(createdTpl !== undefined, 'Found created template in template list');

    // Delete template
    if (createdTpl) {
      const delRes = await fetch(`${BASE_URL}/admin/del_mail_template`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ id: createdTpl.id }),
      });
      const delJson = await delRes.json();
      assert(delJson.success === true, 'Deleted test email template');
    }
  }

  // ----------------------------------------------------
  // 9. Public Site Branding Settings
  // ----------------------------------------------------
  console.log('\n9. Testing Public Site Branding Settings');
  {
    const updateRes = await fetch(`${BASE_URL}/admin/update_web_public`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        app_name: 'Resends',
        meta_description: 'Production CRM & WhatsApp Automation',
        logo: '/brand/logo.png',
      }),
    });
    const updateJson = await updateRes.json();
    assert(updateJson.success === true, 'update_web_public returned success: true');
  }

  // ----------------------------------------------------
  // 10. Audit Logging
  // ----------------------------------------------------
  console.log('\n10. Testing Administrative Audit Trail');
  {
    const auditRes = await fetch(`${BASE_URL}/admin/get_audit_logs`, { headers: adminHeaders });
    const auditJson = await auditRes.json();
    assert(auditJson.success === true, 'get_audit_logs returned success: true');
    assert(Array.isArray(auditJson.data), 'Audit logs data is an array');
    assert(auditJson.data.length > 0, 'Audit logs contains recorded security events');
  }

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
