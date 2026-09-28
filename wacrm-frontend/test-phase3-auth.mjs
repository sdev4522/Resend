import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING PHASE 3 END-TO-END AUTHENTICATION SUITE');
  console.log('====================================================\n');

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

  // 1. Protected route without auth
  await test('Edge Middleware: Unauthenticated access to /dashboard redirects to /login', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert.strictEqual(res.status, 307, `Expected redirect (307), got ${res.status}`);
    const location = res.headers.get('location');
    assert(location && location.includes('/login?callbackUrl=%2Fdashboard'), `Unexpected location: ${location}`);
  });

  // 2. Login Failure
  await test('Login Failure: Invalid credentials returns 401 with human-readable error', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrongpassword' }),
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.msg, 'Invalid credentials');
  });

  // 3. User Registration & Email Verification
  const testEmail = `saas_user_${Date.now()}@example.com`;
  let sessionCookie = '';
  await test('Registration & Verification: New user registers, verifies email, and receives httpOnly session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Workspace',
        email: testEmail,
        password: 'Password123!',
        mobile_with_country_code: '+15550192800',
        acceptPolicy: true,
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.email_verification_required, true);

    // Retrieve OTP from DB to verify
    const dotenv = await import('dotenv');
    dotenv.default.config({ path: '/home/sdev/Projects/wacrm/.env' });
    const { query } = await import('/home/sdev/Projects/wacrm/database/dbpromise.js');
    const crypto = await import('crypto');
    const records = await query('SELECT * FROM email_verification WHERE email = ? ORDER BY id DESC LIMIT 1', [testEmail]);
    assert(records.length === 1);
    let otp = '';
    for (let c = 100000; c <= 999999; c++) {
      const h = crypto.default.createHash('sha256').update(`${testEmail}_${c}`).digest('hex');
      if (h === records[0].token_hash) {
        otp = c.toString();
        break;
      }
    }

    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp }),
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.success, true);
    assert(verifyData.user && verifyData.user.email === testEmail);

    const setCookie = verifyRes.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('wacrm_session='), 'Set-Cookie missing wacrm_session');
    assert(setCookie.includes('HttpOnly'), 'wacrm_session must be HttpOnly');

    // Extract wacrm_session cookie value
    const match = setCookie.match(/wacrm_session=([^;]+)/);
    assert(match, 'Failed to extract wacrm_session');
    sessionCookie = `wacrm_session=${match[1]}`;
  });

  // 4. Current User Session Verification
  await test('Current User (/api/auth/me): Validates session and returns workspace context', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.role, 'user');
    assert(data.workspace, 'Workspace context missing');
    assert.strictEqual(data.workspace.isOwner, true);
    assert.strictEqual(data.user.password, undefined, 'Sensitive password field must never be exposed');
  });

  // 5. Protected Route with Valid Session
  await test('Protected Route with Session: /dashboard is accessible with session cookie', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  // 6. Role Authorization: User blocked from /admin
  await test('Role Guard: Standard user is blocked from /admin and redirected to dashboard', async () => {
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: `${sessionCookie}; wacrm_role=user` },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 307, `Expected redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location && location.includes('/dashboard?error=unauthorized_admin'), `Unexpected location: ${location}`);
  });

  // 7. Onboarding Profile Update via Authenticated Proxy
  await test('Onboarding: Updates profile timezone and details via authenticated API proxy', async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/user/update_profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        name: 'Alex Updated Org',
        email: testEmail,
        mobile_with_country_code: '+15550192800',
        timezone: 'America/New_York',
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify me returns updated timezone
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meData = await meRes.json();
    assert.strictEqual(meData.user.timezone, 'America/New_York');
  });

  // 8. Password Recovery Request
  await test('Password Recovery: /api/auth/forgot-password sends recovery request', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.msg, 'Expected response message');
  });

  // 9. Logout
  await test('Logout: /api/auth/logout clears session and role cookies', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert(setCookie && (setCookie.includes('wacrm_session=;') || setCookie.includes('Max-Age=0')), 'Cookie must be cleared');
  });

  // 10. Session Expired / Invalid Cookie
  await test('Session Invalidation: Invalid cookie returns 401 logout response', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: 'wacrm_session=invalid.jwt.token' },
    });
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.logout, true);
  });

  console.log('\n====================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
