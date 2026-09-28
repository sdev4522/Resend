import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING PHASE 3.5 ROUTING & AUTH VALIDATION ---');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`✅ [PASS] ${name}`);
        passed++;
      } catch (err) {
        console.error(`❌ [FAIL] ${name}:`, err.message);
        failed++;
      }
    })();
  }

  // Flow 1: Open / -> marketing homepage loads with 200 without auth
  await test('Flow 1: Open / loads marketing homepage without redirect', async () => {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('WaCRM'), 'Should contain WaCRM branding');
    assert(html.includes('Sign In'), 'Should contain Sign In button/action');
    assert(html.includes('Get Started'), 'Should contain Get Started button/action');
  });

  // Flow 1b: Public /pricing and /features load with 200
  await test('Flow 1b: /pricing and /features are public 200 OK', async () => {
    const resPricing = await fetch(`${BASE_URL}/pricing`, { redirect: 'manual' });
    assert.strictEqual(resPricing.status, 200, `Expected 200 for /pricing, got ${resPricing.status}`);
    const resFeatures = await fetch(`${BASE_URL}/features`, { redirect: 'manual' });
    assert.strictEqual(resFeatures.status, 200, `Expected 200 for /features, got ${resFeatures.status}`);
  });

  // Flow 2 & 3: Check /api/auth/me for unauthenticated visitor (should not 401 redirect)
  await test('Flow 2-3: Unauthenticated /api/auth/me returns unauthenticated status gracefully', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.unauthenticated, true);
  });

  // Flow 6: Visit /login -> dedicated user login page
  await test('Flow 6: Visit /login loads dedicated user login page', async () => {
    const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Sign in to WaCRM'), 'Should contain login title');
    assert(html.includes('Password'), 'Should contain password field');
  });

  // Flow 7: Visit /register -> dedicated registration page
  await test('Flow 7: Visit /register loads dedicated registration page', async () => {
    const res = await fetch(`${BASE_URL}/register`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Create your account'), 'Should contain registration title');
  });

  // Flow 8: Visit /admin/login -> separate admin login
  await test('Flow 8: Visit /admin/login loads separate admin portal', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('System Administration'), 'Should contain Admin portal header');
  });

  // Flow 9: /login MUST NOT contain Owner/Agent/Admin tabs
  await test('Flow 9: /login MUST NOT contain Owner/Agent/Admin tabs or role selection', async () => {
    const res = await fetch(`${BASE_URL}/login`);
    const html = await res.text();
    assert(!html.includes('role-tabs'), 'Must not contain role-tabs');
    assert(!html.includes('Owner Portal'), 'Must not contain Owner Portal tab');
    assert(!html.includes('Agent Portal'), 'Must not contain Agent Portal tab');
    assert(!html.includes('Admin Portal'), 'Must not contain Admin Portal tab');
  });

  // Flow 10: /admin/login MUST NOT be exposed through public login UI
  await test('Flow 10: /admin/login is NOT exposed or linked in /login UI', async () => {
    const res = await fetch(`${BASE_URL}/login`);
    const html = await res.text();
    assert(!html.includes('/admin/login'), 'Public login must not link to /admin/login');
  });

  // Flow 11: Visit /dashboard while logged out -> redirect to /login
  await test('Flow 11: Logged-out /dashboard redirects to /login', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert([302, 307, 308].includes(res.status), `Expected redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location.includes('/login'), `Expected redirect to /login, got ${location}`);
  });

  // Flow 12: Visit /admin while logged out -> redirect to /admin/login
  await test('Flow 12: Logged-out /admin redirects to /admin/login', async () => {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: 'manual' });
    assert([302, 307, 308].includes(res.status), `Expected redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location.includes('/admin/login'), `Expected redirect to /admin/login, got ${location}`);
  });

  // Flow 13: Normal user attempts /admin -> denied (redirect to dashboard with error)
  await test('Flow 13: Normal user attempting /admin is denied', async () => {
    // Attempt with mock user cookie (role=user)
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: {
        Cookie: 'wacrm_role=user; wacrm_session=mock.jwt.user',
      },
      redirect: 'manual',
    });
    assert([302, 307, 308].includes(res.status), `Expected redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location.includes('unauthorized_admin') || location.includes('/dashboard'), `Expected unauthorized redirect, got ${location}`);
  });

  // Flow 14: Logged-in user visits / -> homepage still loads (200 OK)
  await test('Flow 14: Logged-in user visits / and homepage still loads without redirect', async () => {
    const res = await fetch(`${BASE_URL}/`, {
      headers: {
        Cookie: 'wacrm_role=user; wacrm_session=mock.jwt.user',
      },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 200, `Expected 200 for logged-in user visiting /, got ${res.status}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
