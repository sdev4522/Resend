import assert from 'node:assert';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';

async function verifyAll() {
  console.log('====================================================');
  console.log('PHASE 3.5 — AUTH & MARKETING UX COMPLETE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function check(desc, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${desc}: ${err.message}`);
      failed++;
    }
  }

  // 1. Open / -> marketing homepage loads without authentication
  await check('1. Open / -> loads marketing homepage with 200 OK (no redirect)', async () => {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('WaCRM'), 'Should have WaCRM brand');
  });

  // 2. Marketing navbar contains Sign In & Get Started
  await check('2. Marketing navbar contains Sign In & Get Started actions', async () => {
    const html = await (await fetch(`${BASE_URL}/`)).text();
    assert(html.includes('Sign In'), 'Missing Sign In');
    assert(html.includes('Get Started'), 'Missing Get Started');
  });

  // 3. Auth Dialog Modal architecture exists and is hooked up to RootProvider
  await check('3. Official shadcn Dialog auth modals integrated in RootProvider', async () => {
    const providerCode = fs.readFileSync('components/providers/root-provider.tsx', 'utf8');
    assert(providerCode.includes('AuthDialogProvider'), 'RootProvider must contain AuthDialogProvider');
    assert(providerCode.includes('AuthModals'), 'RootProvider must contain AuthModals');

    const modalsCode = fs.readFileSync('components/auth/auth-modals.tsx', 'utf8');
    assert(modalsCode.includes('LoginDialog'), 'AuthModals must compose LoginDialog');
    assert(modalsCode.includes('RegisterDialog'), 'AuthModals must compose RegisterDialog');
  });

  // 4. LoginDialog uses official shadcn Dialog and LoginForm
  await check('4. LoginDialog uses official shadcn Dialog and shared LoginForm', async () => {
    const dialogCode = fs.readFileSync('components/auth/login-dialog.tsx', 'utf8');
    assert(dialogCode.includes('DialogContent'), 'Must use DialogContent');
    assert(dialogCode.includes('LoginForm'), 'Must render LoginForm');
    assert(!dialogCode.includes('Tabs'), 'Must not contain Tabs');
  });

  // 5. RegisterDialog uses official shadcn Dialog and RegisterForm
  await check('5. RegisterDialog uses official shadcn Dialog and shared RegisterForm', async () => {
    const dialogCode = fs.readFileSync('components/auth/register-dialog.tsx', 'utf8');
    assert(dialogCode.includes('DialogContent'), 'Must use DialogContent');
    assert(dialogCode.includes('RegisterForm'), 'Must render RegisterForm');
    assert(!dialogCode.includes('Tabs'), 'Must not contain Tabs');
  });

  // 6. Visit /login -> dedicated user login page
  await check('6. Visit /login -> dedicated user login page loads', async () => {
    const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('Sign in to WaCRM'), 'Must contain login title');
    assert(html.includes('Password'), 'Must contain password field');
  });

  // 7. Visit /register -> dedicated registration page
  await check('7. Visit /register -> dedicated registration page loads', async () => {
    const res = await fetch(`${BASE_URL}/register`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('Create your account'), 'Must contain register title');
    assert(html.includes('Mobile with Country Code'), 'Must contain WhatsApp phone field');
  });

  // 8. Visit /admin/login -> separate admin login
  await check('8. Visit /admin/login -> separate admin login page loads', async () => {
    const res = await fetch(`${BASE_URL}/admin/login`, { redirect: 'manual' });
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('System Administration'), 'Must contain System Administration title');
  });

  // 9. /login MUST NOT contain Owner/Agent/Admin tabs
  await check('9. /login MUST NOT contain Owner/Agent/Admin tabs or role selection', async () => {
    const html = await (await fetch(`${BASE_URL}/login`)).text();
    assert(!html.includes('role-tabs'), 'No role-tabs in login');
    assert(!html.includes('Owner Portal'), 'No Owner Portal in login');
    assert(!html.includes('Agent Portal'), 'No Agent Portal in login');
    assert(!html.includes('Admin Portal'), 'No Admin Portal in login');
  });

  // 10. /admin/login MUST NOT be exposed through public login UI
  await check('10. /admin/login is NOT exposed in /login or navbar UI', async () => {
    const loginHtml = await (await fetch(`${BASE_URL}/login`)).text();
    assert(!loginHtml.includes('/admin/login'), 'No /admin/login in public login');
    const homeHtml = await (await fetch(`${BASE_URL}/`)).text();
    assert(!homeHtml.includes('/admin/login'), 'No /admin/login in homepage');
  });

  // 11. Visit /dashboard while logged out -> redirect to /login
  await check('11. Visit /dashboard while logged out -> redirects to /login', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert([302, 307, 308].includes(res.status));
    assert(res.headers.get('location').includes('/login'));
  });

  // 12. Visit /admin while logged out -> redirect to /admin/login
  await check('12. Visit /admin while logged out -> redirects to /admin/login', async () => {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: 'manual' });
    assert([302, 307, 308].includes(res.status));
    assert(res.headers.get('location').includes('/admin/login'));
  });

  // 13. Normal user attempts /admin -> denied
  await check('13. Normal user attempting /admin is denied access', async () => {
    const res = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: 'wacrm_role=user; wacrm_session=mock.jwt.user' },
      redirect: 'manual',
    });
    assert([302, 307, 308].includes(res.status));
    assert(res.headers.get('location').includes('unauthorized_admin') || res.headers.get('location').includes('/dashboard'));
  });

  // 14. Logged-in user visits / -> homepage still loads
  await check('14. Logged-in user visits / -> homepage still loads without redirect', async () => {
    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: 'wacrm_role=user; wacrm_session=mock.jwt.user' },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 200);
  });

  // 15. Mobile viewport & Dialog overflow validation
  await check('15. Dialog and layout styles ensure no horizontal overflow on mobile viewports', async () => {
    const dialogPrimitive = fs.readFileSync('components/ui/dialog.tsx', 'utf8');
    assert(dialogPrimitive.includes('max-w-[calc(100%-2rem)]'), 'Must constrain width to viewport padding');
    const loginDialog = fs.readFileSync('components/auth/login-dialog.tsx', 'utf8');
    assert(loginDialog.includes('DialogContent'), 'Uses DialogContent');
    const registerDialog = fs.readFileSync('components/auth/register-dialog.tsx', 'utf8');
    assert(registerDialog.includes('max-h-[90vh] overflow-y-auto'), 'Scrollable on small vertical screens');
  });

  // 16. Template aesthetic validation (no random gradients or glows)
  await check('16. Landing page adheres to pure-landing-shadcnui-template (no random gradients/glows)', async () => {
    const heroCode = fs.readFileSync('components/marketing/hero.tsx', 'utf8');
    assert(!heroCode.includes('blur-['), 'No arbitrary blur glow blobs');
    assert(!heroCode.includes('bg-gradient-to-r'), 'No random gradient text');
    assert(!heroCode.includes('bg-clip-text'), 'No text clipping gradients');

    const navbarCode = fs.readFileSync('components/marketing/navbar.tsx', 'utf8');
    assert(navbarCode.includes('rounded-full'), 'Navbar uses floating pill rounded-full style');
  });

  console.log(`\n====================================================`);
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`====================================================\n`);

  if (failed > 0) process.exit(1);
}

verifyAll();
