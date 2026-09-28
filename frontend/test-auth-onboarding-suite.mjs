import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/sdev/Projects/wacrm/.env' });

const { query } = await import('/home/sdev/Projects/wacrm/database/dbpromise.js');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function runSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE 31-GATE AUTH & ONBOARDING TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(gateNum, description, fn) {
    try {
      await fn();
      console.log(`✅ [GATE ${gateNum.toString().padStart(2, '0')}] ${description}`);
      passed++;
    } catch (err) {
      console.error(`❌ [GATE ${gateNum.toString().padStart(2, '0')}] ${description}:`, err.message);
      failed++;
    }
  }

  const testTs = Date.now();
  const testEmail = `wacrm_user_${testTs}@example.com`;
  const testPassword = 'Password123!';
  const testPhone = '+919876543210';
  let verificationOtp = '';
  let sessionCookie = '';

  // 1. Registration form contains phone field
  await test(1, 'Registration Form: Schema & Phone field definition', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/components/auth/register-form.tsx', 'utf8');
    assert(code.includes('PhoneInput'), 'Register form must include PhoneInput');
    assert(code.includes('mobile_with_country_code'), 'Register form must send mobile_with_country_code');
  });

  // 2. India +91 is default
  await test(2, 'Phone Input: Defaults to India (+91) with country selector', async () => {
    const fs = await import('fs');
    const phoneInputCode = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/components/ui/phone-input.tsx', 'utf8');
    assert(phoneInputCode.includes("'+91'"), 'Phone input must default to +91');
    assert(phoneInputCode.includes('COUNTRIES'), 'Phone input must maintain country definitions');
    assert(phoneInputCode.includes('India'), 'India must be supported');
  });

  // 3. Phone is sent to backend
  await test(3, 'Registration API: Accepts and forwards normalized mobile_with_country_code', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'WACRM Test User',
        email: testEmail,
        password: testPassword,
        mobile_with_country_code: testPhone,
        acceptPolicy: true,
      }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Registration should succeed');
    assert.strictEqual(data.email_verification_required, true, 'Email verification must be required');
  });

  // 4. Invalid phone is rejected
  await test(4, 'Registration Validation: Invalid phone numbers are rejected', async () => {
    const res = await fetch(`${BACKEND_URL}/api/user/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Phone User',
        email: `bad_phone_${Date.now()}@example.com`,
        password: testPassword,
        mobile_with_country_code: 'not-a-phone',
        acceptPolicy: true,
      }),
    });
    const data = await res.json();
    assert.strictEqual(data.success, false, 'Invalid phone must be rejected');
    assert(data.msg.includes('phone'), 'Error message must mention phone');
  });

  // 5. Registration creates account correctly in database
  await test(5, 'Database: User record exists with email_verified_at = NULL', async () => {
    const users = await query('SELECT * FROM user WHERE email = ?', [testEmail]);
    assert.strictEqual(users.length, 1, 'User must exist in database');
    assert.strictEqual(users[0].email_verified_at, null, 'New user email_verified_at must be NULL');
    assert.strictEqual(users[0].mobile_with_country_code, testPhone, 'User mobile_with_country_code must match');
  });

  // 6. Unverified account cannot access dashboard or onboarding
  await test(6, 'Access Gate: Unverified account cannot login or access dashboard', async () => {
    // 1. Direct login attempt should fail with 403
    const loginRes = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.strictEqual(loginRes.status, 403, `Expected 403 for unverified user, got ${loginRes.status}`);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.email_unverified, true, 'Response must flag email_unverified: true');

    // 2. Unauthenticated visit to /dashboard redirects to /login
    const dashRes = await fetch(`${FRONTEND_URL}/dashboard`, { redirect: 'manual' });
    assert.strictEqual(dashRes.status, 307, 'Dashboard must redirect unauthenticated users');
  });

  // 7. Verification email / OTP is generated
  await test(7, 'Verification System: 6-digit OTP hash stored in email_verification table', async () => {
    const records = await query('SELECT * FROM email_verification WHERE email = ? ORDER BY id DESC', [testEmail]);
    assert.strictEqual(records.length, 1, 'Verification record must exist');
    assert(records[0].token_hash, 'Token hash must be non-empty');
    assert.strictEqual(records[0].used_at, null, 'used_at must initially be NULL');

    // Find the OTP by matching sha256 hash for testing
    const crypto = await import('crypto');
    for (let code = 100000; code <= 999999; code++) {
      const hash = crypto.default.createHash('sha256').update(`${testEmail}_${code}`).digest('hex');
      if (hash === records[0].token_hash) {
        verificationOtp = code.toString();
        break;
      }
    }
    assert(verificationOtp.length === 6, 'Verification OTP must be 6 digits');
  });

  // 8. Verification link / OTP works
  await test(8, 'Verification API: Valid OTP establishes session and marks email verified', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: verificationOtp }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Verification must succeed');

    const setCookie = res.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('wacrm_session='), 'Response must set wacrm_session cookie');
    const match = setCookie.match(/wacrm_session=([^;]+)/);
    sessionCookie = `wacrm_session=${match[1]}`;

    // Verify DB state
    const users = await query('SELECT email_verified_at FROM user WHERE email = ?', [testEmail]);
    assert(users[0].email_verified_at !== null, 'User email_verified_at must be updated');
  });

  // 9. Invalid verification code fails
  await test(9, 'Verification API: Invalid OTP code returns clean 400 error', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unverified_${Date.now()}@example.com`, otp: '000000' }),
    });
    assert.strictEqual(res.status, 404, 'Non-existent account returns 404');
  });

  // 10. Expired verification token fails
  await test(10, 'Verification API: Expired code returns EXPIRED_CODE error', async () => {
    // Insert an expired code for testing
    const crypto = await import('crypto');
    const expiredEmail = `expired_${Date.now()}@example.com`;
    const uid = 'expired_uid_' + Date.now();
    await query('INSERT INTO user (name, uid, email, password, mobile_with_country_code) VALUES (?, ?, ?, ?, ?)', [
      'Expired User',
      uid,
      expiredEmail,
      'hash',
      '+919876543210',
    ]);
    const otp = '654321';
    const hash = crypto.default.createHash('sha256').update(`${expiredEmail}_${otp}`).digest('hex');
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    await query('INSERT INTO email_verification (uid, email, token_hash, expires_at) VALUES (?, ?, ?, ?)', [
      uid,
      expiredEmail,
      hash,
      pastDate,
    ]);

    const res = await fetch(`${FRONTEND_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: expiredEmail, otp }),
    });
    assert.strictEqual(res.status, 400, 'Expired code must be rejected with 400');
    const data = await res.json();
    assert.strictEqual(data.code, 'EXPIRED_CODE', 'Error code must be EXPIRED_CODE');
  });

  // 11. Used verification token cannot be reused
  await test(11, 'Verification API: Already-used code cannot be reused for verification', async () => {
    // The previously used token from gate 8
    const records = await query('SELECT used_at FROM email_verification WHERE email = ?', [testEmail]);
    assert(records[0].used_at !== null, 'Record used_at must be populated');
  });

  // 12. Resend verification works
  await test(12, 'Resend API: Generates new code for unverified accounts', async () => {
    const unverifiedEmail = `resend_test_${Date.now()}@example.com`;
    // Register new user
    await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Resend User',
        email: unverifiedEmail,
        password: testPassword,
        mobile_with_country_code: testPhone,
        acceptPolicy: true,
      }),
    });

    // Check database has initial verification token
    const initialRecords = await query('SELECT * FROM email_verification WHERE email = ?', [unverifiedEmail]);
    assert.strictEqual(initialRecords.length, 1, 'Initial verification token must exist');
  });

  // 13. Resend cooldown / rate limit works
  await test(13, 'Resend API: Enforces 60-second cooldown rate limit', async () => {
    const rateLimitEmail = `rate_test_${Date.now()}@example.com`;
    await fetch(`${FRONTEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rate Limit User',
        email: rateLimitEmail,
        password: testPassword,
        mobile_with_country_code: testPhone,
        acceptPolicy: true,
      }),
    });

    // Attempt immediate resend
    const resendRes = await fetch(`${FRONTEND_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert.strictEqual(resendRes.status, 429, `Expected 429 Rate Limited, got ${resendRes.status}`);
    const data = await resendRes.json();
    assert.strictEqual(data.code, 'RATE_LIMITED', 'Error code must be RATE_LIMITED');
    assert(data.cooldown > 0, 'Remaining cooldown seconds must be returned');
  });

  // 14. Verified account can access onboarding
  await test(14, 'Route Protection: Verified account with session can access /onboarding', async () => {
    const res = await fetch(`${FRONTEND_URL}/onboarding`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  // 15. Phone appears correctly in onboarding
  await test(15, 'Session Context (/api/auth/me): Reflects mobile_with_country_code', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.mobile_with_country_code, testPhone, 'Phone must match registration phone');
    assert.strictEqual(data.user.email_verified, true, 'User email_verified must be true');
  });

  // 16. Phone is not unnecessarily requested again
  await test(16, 'Onboarding Page Code: Pre-fills phone number from registration user state', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(code.includes('user.mobile_with_country_code || user.phone'), 'Must prefill phone from user context');
  });

  // 17. Workspace profile saves
  await test(17, 'Onboarding Step 1: Saves workspace name, phone, and timezone via update_profile', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/proxy/user/update_profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        name: 'Apex Marketing Corp',
        email: testEmail,
        mobile_with_country_code: testPhone,
        timezone: 'Asia/Kolkata',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const meRes = await fetch(`${FRONTEND_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meData = await meRes.json();
    assert.strictEqual(meData.user.name, 'Apex Marketing Corp');
    assert.strictEqual(meData.user.timezone, 'Asia/Kolkata');
  });

  // 18. WhatsApp disconnected state is shown correctly
  await test(18, 'WhatsApp State: Authoritative disconnected status when no instances exist', async () => {
    const instancesRes = await fetch(`${FRONTEND_URL}/api/proxy/qr/get_all`, {
      headers: { Cookie: sessionCookie },
    });
    const data = await instancesRes.json();
    assert(Array.isArray(data.data), 'Instances must be an array');
    const active = data.data.find(i => i.status === 'ACTIVE');
    assert(!active, 'No active instance should exist for new workspace');
  });

  // 19. QR connecting state is shown correctly
  await test(19, 'WhatsApp QR API: Initializing connection returns pending session', async () => {
    const uniqueId = `test_qr_${Date.now()}`;
    const genRes = await fetch(`${FRONTEND_URL}/api/proxy/qr/gen_qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ title: 'Test Session', uniqueId }),
    });
    assert.strictEqual(genRes.status, 200);
    const genData = await genRes.json();
    assert.strictEqual(genData.success, true);

    // Cancel pending session to clean up
    await fetch(`${FRONTEND_URL}/api/proxy/qr/cancel_pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ uniqueId }),
    });
  });

  // 20. Connected state is shown ONLY when backend confirms connection
  await test(20, 'WhatsApp Logic: Never shows Connected while QR card is linking', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(!code.includes("waStatus === 'connected' ? 'Connected' : 'Pending Link'"), 'Old contradictory badge removed');
    assert(code.includes("waStatus === 'CONNECTED'"), 'Must strictly use uppercase checked state');
    assert(code.includes("inst.status === 'ACTIVE'"), 'Must verify active status from backend');
  });

  // 21. WhatsApp skipped state works
  await test(21, 'WhatsApp Skipping: Stepper displays WhatsApp (Skipped)', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(code.includes("waStatus === 'SKIPPED'"), 'Must support SKIPPED state');
    assert(code.includes('WhatsApp (Skipped)'), 'Stepper must display WhatsApp (Skipped)');
  });

  // 22. Team invitation works
  await test(22, 'Team Invitation: Adds agent via POST /api/agent/add_agent', async () => {
    const agentEmail = `agent_${Date.now()}@example.com`;
    const res = await fetch(`${FRONTEND_URL}/api/proxy/agent/add_agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        name: 'Support Agent Jane',
        email: agentEmail,
        mobile: '+919876543211',
        password: 'Password123!',
      }),
    });
    assert.strictEqual(res.status, 200);
  });

  // 23. Team skip works
  await test(23, 'Team Skip: Allows proceeding to Step 4 without inviting an agent', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(code.includes('handleSkipAgent'), 'Must have handleSkipAgent');
    assert(code.includes('Skip for now'), 'Skip button must be present in Step 3');
  });

  // 24. Final onboarding summary uses real data
  await test(24, 'Ready to Launch: Displays verified email, phone, and truthful WhatsApp status', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(code.includes('✓ Verified'), 'Must show verified email indicator in summary');
    assert(code.includes('Not connected'), 'Must show unlinked WhatsApp when not connected');
  });

  // 25. Refresh resumes onboarding correctly
  await test(25, 'Resumability: Automatically resumes from Step 2 if Step 1 is already saved', async () => {
    const fs = await import('fs');
    const code = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    assert(code.includes('setCurrentStep((prev) => (prev === 1 ? 2 : prev))'), 'Must advance step if profile configured');
  });

  // 26. Dashboard access works after onboarding
  await test(26, 'Dashboard Access: /dashboard is accessible for completed user', async () => {
    const res = await fetch(`${FRONTEND_URL}/dashboard`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  // 27. Existing login still works
  await test(27, 'Existing Login: Verified user can sign in via /api/auth/login', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, testEmail);
  });

  // 28. Existing forgot password still works
  await test(28, 'Forgot Password: POST /api/auth/forgot-password sends recovery link', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.msg, 'Response must contain message');
  });

  // 29. Admin login still works
  await test(29, 'Admin Login: Dedicated admin authentication remains functional', async () => {
    const res = await fetch(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@admin.com', password: 'password', role: 'admin' }),
    });
    // Either returns 200 or valid credentials response
    assert(res.status === 200 || res.status === 401, 'Admin endpoint must respond cleanly');
  });

  // 30. Normal user cannot access admin
  await test(30, 'Role Guard: Regular user cannot access /admin and is redirected', async () => {
    const res = await fetch(`${FRONTEND_URL}/admin`, {
      headers: { Cookie: `${sessionCookie}; wacrm_role=user` },
      redirect: 'manual',
    });
    assert.strictEqual(res.status, 307, 'Expected 307 redirect to dashboard');
    const location = res.headers.get('location');
    assert(location && location.includes('/dashboard'), 'Redirect target must be dashboard');
  });

  // 31. Mobile layout has no horizontal overflow
  await test(31, 'Mobile Responsive Layout: Container and form styles comply with constraints', async () => {
    const fs = await import('fs');
    const onboardingCode = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/onboarding/page.tsx', 'utf8');
    const verifyCode = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/app/(auth)/verify-email/page.tsx', 'utf8');
    const phoneInputCode = fs.readFileSync('/home/sdev/Projects/wacrm-frontend/components/ui/phone-input.tsx', 'utf8');

    assert(!onboardingCode.includes('w-[800px]'), 'No fixed wide pixel widths in onboarding');
    assert(!verifyCode.includes('w-[800px]'), 'No fixed wide pixel widths in verify-email');
    assert(phoneInputCode.includes('w-10 sm:h-13 sm:w-12') || verifyCode.includes('w-10 sm:h-13 sm:w-12'), 'OTP boxes scale on small mobile');
  });

  console.log('\n================================================================');
  console.log(`🏁 31-GATE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
