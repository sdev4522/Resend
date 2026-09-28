import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
const { sign, decode: decodeJwt } = jwt;
import crypto from 'crypto';
import FormData from 'form-data';
import { query } from './database/dbpromise.js';
import { validateSafeUrl } from './utils/ssrfGuard.js';
import { verifyRazorpaySignature } from './helper/razorpay.js';

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
  console.log('  STARTING PHASE 12 SECURITY HARDENING & REGRESSION SUITE');
  console.log('================================================================\n');

  // Load test subjects
  const admins = await query("SELECT * FROM admin LIMIT 1");
  const users = await query("SELECT * FROM user WHERE is_blocked = 0 ORDER BY id ASC LIMIT 2");

  if (!admins.length || users.length < 2) {
    console.error("Missing admin or at least 2 users in database for security testing.");
    process.exit(1);
  }

  const admin = admins[0];
  const userA = users[0];
  const userB = users[1];

  let adminToken = sign({ uid: admin.uid, role: 'admin', tokenVersion: admin.tokenVersion || 0 }, JWTKEY);
  let userAToken = sign({ uid: userA.uid, role: 'user', tokenVersion: userA.tokenVersion || 0 }, JWTKEY);
  let userBToken = sign({ uid: userB.uid, role: 'user', tokenVersion: userB.tokenVersion || 0 }, JWTKEY);

  const getHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // =========================================================================
  // 1. ANONYMOUS ACCESS REJECTION
  // =========================================================================
  console.log('1. Anonymous Access Boundary');
  {
    const res = await fetch(`${BASE_URL}/phonebook/get_by_uid`, {
      headers: getHeaders(null),
    });
    assert(res.status === 401, `Anonymous request to /api/phonebook/get_by_uid rejected with 401 (got ${res.status})`);
  }

  // =========================================================================
  // 2. TENANT ISOLATION: PHONEBOOKS & CONTACTS
  // =========================================================================
  console.log('\n2. Tenant Isolation: Phonebooks & Contacts');
  let testPbAId = null;
  let testContactAId = null;

  try {
    // Create phonebook for User A
    const pbRes = await fetch(`${BASE_URL}/phonebook/add`, {
      method: 'POST',
      headers: getHeaders(userAToken),
      body: JSON.stringify({ name: `TenantA_SecPb_${Date.now()}` }),
    });
    const pbData = await pbRes.json();
    assert(pbData.success, 'Created test phonebook for User A');

    // Retrieve phonebook ID
    const listPbRes = await fetch(`${BASE_URL}/phonebook/get_by_uid`, {
      headers: getHeaders(userAToken),
    });
    const listPb = await listPbRes.json();
    const createdPb = listPb.data?.find((p) => p.name?.startsWith('TenantA_SecPb_'));
    testPbAId = createdPb?.id;
    assert(!!testPbAId, `Found created phonebook id: ${testPbAId}`);

    // Create a contact for User A
    const addContactRes = await fetch(`${BASE_URL}/phonebook/add_single_contact`, {
      method: 'POST',
      headers: getHeaders(userAToken),
      body: JSON.stringify({
        id: testPbAId,
        phonebook_id: testPbAId,
        name: 'SecTestContact',
        mobile: '919999999991',
      }),
    });
    const addContactData = await addContactRes.json();
    assert(addContactData.success, `Added contact for User A (${addContactData.msg || ''})`);

    // Retrieve contact ID
    const [cRow] = await query("SELECT id FROM contact WHERE uid = ? AND phonebook_id = ? ORDER BY id DESC LIMIT 1", [
      userA.uid,
      testPbAId,
    ]);
    testContactAId = cRow?.id;
    assert(!!testContactAId, `Found contact id: ${testContactAId}`);

    // Cross-tenant attack 1: User B tries to insert a contact into User A's phonebook
    const crossAddRes = await fetch(`${BASE_URL}/phonebook/add_single_contact`, {
      method: 'POST',
      headers: getHeaders(userBToken),
      body: JSON.stringify({
        phonebook_id: testPbAId,
        name: 'AttackerContact',
        mobile: '918888888882',
      }),
    });
    assert(crossAddRes.status === 404 || crossAddRes.status === 403, `Cross-tenant contact insertion rejected with 404/403 (got ${crossAddRes.status})`);

    // Cross-tenant attack 2: User B tries to delete User A's contact
    const crossDelContactRes = await fetch(`${BASE_URL}/phonebook/del_contacts`, {
      method: 'POST',
      headers: getHeaders(userBToken),
      body: JSON.stringify({
        contacts: [testContactAId],
      }),
    });
    // Check that contact was NOT deleted
    const [stillExistsContact] = await query("SELECT id FROM contact WHERE id = ?", [testContactAId]);
    assert(!!stillExistsContact, `Cross-tenant contact deletion rejected: Contact ${testContactAId} still exists`);

    // Cross-tenant attack 3: User B tries to delete User A's phonebook
    const crossDelPbRes = await fetch(`${BASE_URL}/phonebook/del_phonebook`, {
      method: 'POST',
      headers: getHeaders(userBToken),
      body: JSON.stringify({ id: testPbAId }),
    });
    assert(crossDelPbRes.status === 404 || crossDelPbRes.status === 403, `Cross-tenant phonebook deletion rejected with 404/403 (got ${crossDelPbRes.status})`);

    // Verify User A's phonebook is still present
    const [stillExistsPb] = await query("SELECT id FROM phonebook WHERE id = ?", [testPbAId]);
    assert(!!stillExistsPb, `User A phonebook ${testPbAId} remains safe and untouched`);
  } finally {
    // Cleanup
    if (testContactAId) await query("DELETE FROM contact WHERE id = ?", [testContactAId]);
    if (testPbAId) await query("DELETE FROM phonebook WHERE id = ?", [testPbAId]);
  }

  // =========================================================================
  // 3. RBAC BOUNDARIES (User / Agent cannot access Admin API)
  // =========================================================================
  console.log('\n3. RBAC Privilege Escalation Prevention');
  {
    // User tries to read admin users list
    const userAdminUsersRes = await fetch(`${BASE_URL}/admin/get_users`, {
      headers: getHeaders(userAToken),
    });
    assert(userAdminUsersRes.status === 403, `User token access to /api/admin/get_users rejected with 403 (got ${userAdminUsersRes.status})`);

    // User tries to call admin add_plan
    const userAdminPlanRes = await fetch(`${BASE_URL}/admin/add_plan`, {
      method: 'POST',
      headers: getHeaders(userAToken),
      body: JSON.stringify({ title: 'Hacked Plan' }),
    });
    assert(userAdminPlanRes.status === 403, `User token access to /api/admin/add_plan rejected with 403 (got ${userAdminPlanRes.status})`);

    // Admin access succeeds
    const adminRes = await fetch(`${BASE_URL}/admin/get_users`, {
      headers: getHeaders(adminToken),
    });
    assert(adminRes.status === 200, `Admin token access to /api/admin/get_users granted (got ${adminRes.status})`);
  }

  // =========================================================================
  // 4. SESSION REVOCATION & LOGOUT INVALIDATION
  // =========================================================================
  console.log('\n4. Session Revocation (tokenVersion)');
  {
    // Fresh token for User A
    const [freshUserA] = await query("SELECT tokenVersion FROM user WHERE uid = ?", [userA.uid]);
    const currentVersion = freshUserA?.tokenVersion || 0;
    const sessionToken = sign({ uid: userA.uid, role: 'user', tokenVersion: currentVersion }, JWTKEY);

    // Call protected route: should succeed
    const beforeRes = await fetch(`${BASE_URL}/phonebook/get_by_uid`, {
      headers: getHeaders(sessionToken),
    });
    assert(beforeRes.status === 200, `Active session token allowed before logout (status ${beforeRes.status})`);

    // Call logout endpoint
    const logoutRes = await fetch(`${BASE_URL}/user/logout`, {
      method: 'POST',
      headers: getHeaders(sessionToken),
    });
    const logoutData = await logoutRes.json();
    assert(logoutData.success, 'User logout API completed successfully');

    // Call protected route with the logged-out token: MUST BE REJECTED WITH 401
    const afterRes = await fetch(`${BASE_URL}/phonebook/get_by_uid`, {
      headers: getHeaders(sessionToken),
    });
    assert(afterRes.status === 401, `Revoked session token rejected with 401 after logout (got ${afterRes.status})`);

    // Refresh userAToken for subsequent tests
    const [updatedUserA] = await query("SELECT tokenVersion FROM user WHERE uid = ?", [userA.uid]);
    userAToken = sign({ uid: userA.uid, role: 'user', tokenVersion: updatedUserA?.tokenVersion || 0 }, JWTKEY);
  }

  // =========================================================================
  // 5. PASSWORD RESET TOKEN INTEGRITY & SINGLE-USE
  // =========================================================================
  console.log('\n5. Password Reset Token Security');
  {
    // Request password reset token via API
    const recoveryRes = await fetch(`${BASE_URL}/user/send_resovery`, {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify({ email: userA.email }),
    });
    const recoveryData = await recoveryRes.json();
    assert(recoveryData.success, `Password recovery initiated for ${userA.email}`);
    assert(!recoveryData.token, 'Recovery API does NOT leak reset token in HTTP response (sent via email only)');

    // Generate valid reset token with user's current tokenVersion
    const [userRow] = await query("SELECT tokenVersion, password FROM user WHERE uid = ?", [userA.uid]);
    const resetToken = sign(
      {
        uid: userA.uid,
        email: userA.email,
        purpose: 'password_reset',
        tokenVersion: userRow?.tokenVersion || 0,
      },
      JWTKEY,
      { expiresIn: '1h' },
    );

    // Verify token does NOT leak bcrypt password hash
    const decoded = decodeJwt(resetToken);
    assert(!decoded.password, 'Reset token JWT payload does NOT leak password hash');
    assert(decoded.purpose === 'password_reset', 'Reset token is explicitly scoped to purpose "password_reset"');

    // Use token to reset password
    const newPassword = 'SecureP@ssword2026!';
    const resetRes = await fetch(`${BASE_URL}/user/modify_password`, {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });
    const resetData = await resetRes.json();
    assert(resetData.success, `Password successfully reset with token`);

    // Replay attack: attempt to reuse the exact same reset token
    const replayRes = await fetch(`${BASE_URL}/user/modify_password`, {
      method: 'POST',
      headers: getHeaders(null),
      body: JSON.stringify({ token: resetToken, password: 'AnotherPassword!' }),
    });
    assert(replayRes.status === 400 || replayRes.status === 401, `Reset token replay rejected with 400/401 (got ${replayRes.status})`);

    // Refresh User A token version
    const [refreshedUserA] = await query("SELECT tokenVersion FROM user WHERE uid = ?", [userA.uid]);
    userAToken = sign({ uid: userA.uid, role: 'user', tokenVersion: refreshedUserA?.tokenVersion || 0 }, JWTKEY);
  }

  // =========================================================================
  // 6. RCE / SANDBOX BREAKOUT RESISTANCE
  // =========================================================================
  console.log('\n6. RCE / Sandbox Breakout Resistance (/try_js)');
  {
    const dangerousPayloads = [
      "this.constructor.constructor('return process')().mainModule.require('child_process').execSync('id')",
      "require('fs').readFileSync('/etc/passwd')",
      "process.exit(1)",
      "import('node:fs')",
      "Function('return globalThis')().process.mainModule",
    ];

    for (const code of dangerousPayloads) {
      const sandboxRes = await fetch(`${BASE_URL}/user/try_js`, {
        method: 'POST',
        headers: getHeaders(userAToken),
        body: JSON.stringify({
          code,
          variables: {},
        }),
      });
      const sandboxData = await sandboxRes.json();
      assert(
        !sandboxData.success || sandboxData.result === undefined || String(sandboxData.error || '').includes('Disallowed') || String(sandboxData.error || '').includes('Security error'),
        `Dangerous code injection safely blocked: "${code.substring(0, 35)}..."`
      );
    }
  }

  // =========================================================================
  // 7. SSRF PROTECTION
  // =========================================================================
  console.log('\n7. SSRF Guard (Private IPs, Cloud Metadata & Non-HTTP)');
  {
    const ssrfTargets = [
      'http://127.0.0.1:3001/api/admin/plans',
      'http://localhost:3000',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/secret',
      'http://192.168.1.100/admin',
      'file:///etc/passwd',
      'gopher://127.0.0.1:6379/_flushall',
    ];

    for (const url of ssrfTargets) {
      let blocked = false;
      try {
        await validateSafeUrl(url);
      } catch (err) {
        blocked = true;
      }
      assert(blocked, `SSRF target safely blocked: ${url}`);
    }
  }

  // =========================================================================
  // 8. META WEBHOOK SIGNATURE VERIFICATION
  // =========================================================================
  console.log('\n8. Meta Webhook Signature Verification');
  {
    // Fake unsigned webhook payload
    const spoofedPayload = {
      entry: [{ changes: [{ field: 'messages', value: { messages: [] } }] }],
    };

    const rejectRes = await fetch(`${BASE_URL}/inbox/webhook/${userA.uid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: JSON.stringify(spoofedPayload),
    });
    assert(rejectRes.status === 403, `Spoofed Meta webhook signature rejected with 403 (got ${rejectRes.status})`);

    // Valid signature with configured secret
    const [web] = await query("SELECT embed_app_sec FROM web_private LIMIT 1");
    if (web?.embed_app_sec) {
      const payloadString = JSON.stringify(spoofedPayload);
      const validSig = 'sha256=' + crypto.createHmac('sha256', web.embed_app_sec).update(payloadString).digest('hex');
      const validRes = await fetch(`${BASE_URL}/inbox/webhook/${userA.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSig,
        },
        body: payloadString,
      });
      assert(validRes.status === 200, `Valid Meta webhook signature accepted with 200 (got ${validRes.status})`);
    } else {
      console.log('  ℹ Meta app secret not configured in web_private; skipping valid signature test');
    }
  }

  // =========================================================================
  // 9. RAZORPAY WEBHOOK & PAYMENT HARDENING
  // =========================================================================
  console.log('\n9. Razorpay Webhook & Payment Security');
  {
    // Webhook with invalid signature
    const invalidWhRes = await fetch(`${BASE_URL}/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_signature_hex_1234567890',
      },
      body: JSON.stringify({ event: 'payment.captured' }),
    });
    assert(invalidWhRes.status === 400, `Invalid Razorpay signature rejected with 400 (got ${invalidWhRes.status})`);

    // Webhook idempotency test
    const [webPrivate] = await query("SELECT rz_webhook_secret FROM web_private LIMIT 1");
    const secret = webPrivate?.rz_webhook_secret || 'test_wh_secret_xyz';

    // Temporarily set secret if empty for test
    if (!webPrivate?.rz_webhook_secret) {
      await query("UPDATE web_private SET rz_webhook_secret = ? LIMIT 1", [secret]);
    }

    const testEventId = `sec_test_evt_${Date.now()}`;
    const payloadObj = {
      event: 'payment.captured',
      event_id: testEventId,
      payload: { payment: { entity: { id: `pay_${Date.now()}` } } },
    };
    const rawPayload = JSON.stringify(payloadObj);
    const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    // First delivery: should process
    const firstDeliveryRes = await fetch(`${BASE_URL}/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: rawPayload,
    });
    const firstDeliveryData = await firstDeliveryRes.json();
    assert(firstDeliveryData.status === 'ok', 'First webhook delivery accepted');

    // Duplicate delivery: MUST BE IDEMPOTENT
    const secondDeliveryRes = await fetch(`${BASE_URL}/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: rawPayload,
    });
    const secondDeliveryData = await secondDeliveryRes.json();
    assert(secondDeliveryData.duplicate === true, 'Duplicate webhook delivery safely identified and ignored (idempotent)');

    // Mock signature in production mode test
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const mockSigResult = await verifyRazorpaySignature({
      orderId: 'order_mock_test123',
      paymentId: 'pay_test123',
      signature: 'mock_signature_dev_test',
    });
    assert(mockSigResult === false, 'Mock signature strictly rejected when NODE_ENV === "production"');
    process.env.NODE_ENV = originalNodeEnv;
  }

  // =========================================================================
  // 10. CSV IMPORT FILE RESTRICTIONS
  // =========================================================================
  console.log('\n10. File Upload Hardening (CSV import)');
  {
    // Try uploading an executable file pretending to be CSV
    const form = new FormData();
    form.append('id', '1');
    form.append('file', Buffer.from('#!/bin/bash\necho hacked\n'), {
      filename: 'exploit.sh',
      contentType: 'application/x-sh',
    });

    const uploadRes = await fetch(`${BASE_URL}/phonebook/import_contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        ...form.getHeaders(),
      },
      body: form,
    });
    assert(uploadRes.status === 400, `Non-CSV file upload to /import_contacts rejected with 400 (got ${uploadRes.status})`);
  }

  // =========================================================================
  // 11. SECURITY HEADERS
  // =========================================================================
  console.log('\n11. Production Security Headers');
  {
    const headerRes = await fetch(`${BASE_URL}/phonebook/get_by_uid`, {
      headers: getHeaders(userAToken),
    });
    assert(headerRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff present');
    assert(headerRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN present');
    assert(headerRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy present');
  }

  // =========================================================================
  // 12. RATE LIMITING BURST PROTECTION
  // =========================================================================
  console.log('\n12. Authentication Rate Limiting');
  {
    let rateLimited = false;
    // Rapid burst of 20 invalid login attempts to trigger authRateLimiter (limit: 15)
    for (let i = 0; i < 20; i++) {
      const loginRes = await fetch(`${BASE_URL}/user/login`, {
        method: 'POST',
        headers: getHeaders(null),
        body: JSON.stringify({ email: `burst_test_${i}@example.com`, password: 'wrongpassword' }),
      });
      if (loginRes.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Auth rate limiter successfully triggered (HTTP 429 Too Many Requests)');
  }

  console.log('\n================================================================');
  console.log(`  PHASE 12 SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
