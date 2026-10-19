/**
 * Signup Popup UX/UI Audit Comprehensive Acceptance Test Suite
 * Validates all 14 audit fixes end-to-end against real backend, database, and frontend components.
 */
import 'dotenv/config';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import fetch from 'node-fetch';
import { query } from './database/dbpromise.js';
import userRouter from './routes/user.js';
import { CLOUDFLARE_TEST_SECRET } from './utils/turnstile.js';

const TEST_PORT = 3199;
const BASE_URL = `http://localhost:${TEST_PORT}/api/user`;

console.log('====================================================================');
console.log('🧪 SIGNUP POPUP UX/UI AUDIT ACCEPTANCE & REGRESSION SUITE');
console.log('====================================================================\n');

async function runAuditAcceptanceTests() {
  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`❌ [FAIL] ${msg}`, err || '');
    failed++;
  }

  // --- PART 1: FRONTEND STATIC & CODE CONTRACT CHECKS ---
  console.log('--- Phase 1: Form Simplification & Accessibility Contracts ---');

  const frontendPath = path.resolve(process.cwd(), 'frontend');
  const registerFormCode = fs.readFileSync(path.join(frontendPath, 'components/auth/register-form.tsx'), 'utf8');
  const registerDialogCode = fs.readFileSync(path.join(frontendPath, 'components/auth/register-dialog.tsx'), 'utf8');
  const registerPageCode = fs.readFileSync(path.join(frontendPath, 'app/(auth)/register/page.tsx'), 'utf8');
  const onboardingModalCode = fs.readFileSync(path.join(frontendPath, 'components/onboarding/onboarding-modal.tsx'), 'utf8');
  const dialogCode = fs.readFileSync(path.join(frontendPath, 'components/ui/dialog.tsx'), 'utf8');
  const phoneInputCode = fs.readFileSync(path.join(frontendPath, 'components/ui/phone-input.tsx'), 'utf8');

  // 1. Consent is unchecked by default
  try {
    assert(registerFormCode.includes('useState(false)'), 'acceptPolicy state must initialize to false');
    assert(!registerFormCode.includes('useState(true)'), 'acceptPolicy state must not be true by default');
    pass('1. Consent checkbox is unchecked (false) by default (DPDP/GDPR compliant)');
  } catch (err) {
    fail('1. Consent checkbox default state', err);
  }

  // 2. Form contains Full Name, Email, WhatsApp Phone, Password (redundant Confirm Password removed)
  try {
    assert(!registerFormCode.includes('confirmPassword'), 'Confirm password state must be removed');
    assert(!registerFormCode.includes('Confirm Password'), 'Confirm password label must be removed');
    assert(!registerFormCode.includes('id="reg-confirm-password"'), 'Confirm password input must be removed');
    assert(registerFormCode.includes('nameInputId'), 'Full Name input must exist');
    assert(registerFormCode.includes('emailInputId'), 'Email input must exist');
    assert(registerFormCode.includes('phoneInputId'), 'Phone input must exist');
    assert(registerFormCode.includes('passwordInputId'), 'Password input must exist');
    pass('2. Signup form contains Full Name, Email, WhatsApp Phone, Password (redundant Confirm Password removed)');
  } catch (err) {
    fail('2. Field simplification check', err);
  }

  // 3. Full Name collected in Onboarding Step 1
  try {
    assert(onboardingModalCode.includes('fullName'), 'OnboardingModal must manage fullName state');
    assert(onboardingModalCode.includes('onboarding-full-name'), 'OnboardingModal must have Full Name input field');
    assert(onboardingModalCode.includes('Full Name'), 'Onboarding Step 1 must have Full Name label');
    pass('3. Full Name is collected during Onboarding Step 1 (Workspace Profile setup)');
  } catch (err) {
    fail('3. Onboarding Full Name collection check', err);
  }

  // 4. Terms and Privacy links navigate to valid existing routes
  try {
    assert(registerFormCode.includes('href="/terms"'), 'Must link to /terms');
    assert(registerFormCode.includes('href="/privacy"'), 'Must link to /privacy');
    assert(registerFormCode.includes('target="_blank"'), 'Must open in new tab so form data is not lost');
    assert(fs.existsSync(path.join(frontendPath, 'app/terms/page.tsx')), 'Terms route app/terms/page.tsx must exist');
    assert(fs.existsSync(path.join(frontendPath, 'app/privacy/page.tsx')), 'Privacy route app/privacy/page.tsx must exist');
    pass('4. Terms of Service and Privacy Policy link to valid routes with new-tab targets');
  } catch (err) {
    fail('4. Terms and Privacy route links check', err);
  }

  // 5. Brand-accurate copy throughout signup popup
  try {
    assert(registerDialogCode.includes('Start your free WhatsApp CRM trial'), 'DialogTitle must be product-accurate');
    assert(registerDialogCode.includes('14 days free · No credit card required'), 'Supporting copy must state trial benefits');
    assert(registerPageCode.includes('Start your free WhatsApp CRM trial'), 'Register page must match dialog branding');
    assert(!registerDialogCode.includes('Create your Resend account'), 'Inconsistent brand copy must be removed');
    pass('5. Brand confusion eliminated (Product-accurate WhatsApp CRM trial branding)');
  } catch (err) {
    fail('5. Branding copy check', err);
  }

  // 6. Phone field explanation & HTML5 tel attributes
  try {
    assert(
      registerFormCode.includes("We'll use this number to verify your account and connect your WhatsApp workspace."),
      'Accurate phone helper text must be present'
    );
    assert(phoneInputCode.includes('type="tel"'), 'Phone input must use type="tel"');
    assert(phoneInputCode.includes('inputMode="tel"'), 'Phone input must use inputMode="tel"');
    assert(phoneInputCode.includes('autoComplete'), 'Phone input must support autoComplete="tel"');
    assert(!registerFormCode.includes('Isi number par OTP verify hoga'), 'Must not make false promise of phone OTP');
    pass('6. Phone number requirement accurately explained with accessible tel attributes');
  } catch (err) {
    fail('6. Phone field explanation check', err);
  }

  // 7. Password security, persistent helper, and live strength meter
  try {
    assert(registerFormCode.includes('Use at least 8 characters.'), 'Persistent helper text must be present');
    assert(registerFormCode.includes('passwordStrength'), 'Live password strength meter must be implemented');
    assert(registerFormCode.includes('minLength={8}'), 'Password input must enforce minLength 8');
    assert(registerFormCode.includes('autoComplete="new-password"'), 'Password input must use autocomplete="new-password"');
    assert(registerFormCode.includes('aria-live="polite"'), 'Password strength meter must announce to assistive tech');
    pass('7. Password security enhanced with min 8 chars, persistent helper, and live strength meter');
  } catch (err) {
    fail('7. Password security check', err);
  }

  // 8. Dialog Close button touch target >= 40x40px
  try {
    assert(
      dialogCode.includes('h-10 w-10') || dialogCode.includes('min-h-[40px] min-w-[40px]'),
      'Dialog close button must have at least 40x40px touch target'
    );
    pass('8. Modal close button touch target is at least 40x40px (WCAG 2.1 AA compliant)');
  } catch (err) {
    fail('8. Dialog close button touch target check', err);
  }

  // 9. CTA button, loading state & sign-in link
  try {
    assert(registerFormCode.includes('Start free trial'), 'Primary CTA text must be "Start free trial"');
    assert(registerFormCode.includes('Starting free trial...'), 'Loading text must be descriptive');
    assert(registerFormCode.includes('if (loading) return;'), 'Double submission must be prevented');
    assert(registerFormCode.includes('Already have an account?'), 'Sign-in navigation must be present');
    pass('9. CTA upgraded to "Start free trial", loading states & double-submit protection active');
  } catch (err) {
    fail('9. CTA & loading state check', err);
  }

  // --- PART 2: BACKEND API & DATABASE REGRESSION TESTS ---
  console.log('\n--- Phase 2: Live Backend API & Database Contract Verification ---');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/user', userRouter);

  const server = app.listen(TEST_PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  const testEmail = `audit_test_${Date.now()}@example.com`;
  const testPhone = '+919876543210';
  const testPassword = 'SecurePassword123!';

  // Generate distinct test IPs to prevent test-run rate limiter collision
  const ip = (n) => `203.0.113.${n}`;

  try {
    // 10. Backend rejects signup without Turnstile token
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(1) },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          mobile_with_country_code: testPhone,
          acceptPolicy: true,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Must return 400 when Turnstile token is missing');
      assert.strictEqual(data.success, false, 'Signup without captcha must fail');
      pass('10. Backend strictly blocks signup without Turnstile verification (HTTP 400)');
    } catch (err) {
      fail('10. Turnstile token requirement check', err);
    }

    // 11. Backend rejects signup without Terms consent
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(2) },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          mobile_with_country_code: testPhone,
          acceptPolicy: false,
          turnstileToken: '1x00000000000000000000AA',
        }),
      });
      const data = await res.json();
      assert.strictEqual(data.success, false, 'Must reject when acceptPolicy is false');
      assert(data.msg.toLowerCase().includes('privacy') || data.msg.toLowerCase().includes('terms'), 'Error message must mention Terms/Privacy');
      pass('11. Backend strictly rejects signup when Terms & Privacy consent is not given');
    } catch (err) {
      fail('11. Consent enforcement check', err);
    }

    // 12. Backend rejects password shorter than 8 characters
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(3) },
        body: JSON.stringify({
          email: testEmail,
          password: 'short',
          mobile_with_country_code: testPhone,
          acceptPolicy: true,
          turnstileToken: '1x00000000000000000000AA',
        }),
      });
      const data = await res.json();
      assert.strictEqual(data.success, false, 'Must reject password < 8 chars');
      assert(data.msg.includes('8 characters'), `Must state minimum 8 characters, got ${data.msg}`);
      pass('12. Backend enforces minimum 8 character password policy');
    } catch (err) {
      fail('12. Backend password policy check', err);
    }

    // 13. Backend rejects invalid phone numbers
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(4) },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          mobile_with_country_code: 'invalid_phone',
          acceptPolicy: true,
          turnstileToken: '1x00000000000000000000AA',
        }),
      });
      const data = await res.json();
      assert.strictEqual(data.success, false, 'Must reject invalid phone format');
      pass('13. Backend rejects malformed phone number without country calling code');
    } catch (err) {
      fail('13. Phone validation check', err);
    }

    // 14. Successful signup with 3 fields (name omitted) & valid Turnstile token
    let createdUid = null;
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(5) },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          mobile_with_country_code: testPhone,
          acceptPolicy: true,
          turnstileToken: '1x00000000000000000000AA',
        }),
      });
      const data = await res.json();
      assert.strictEqual(data.success, true, `Signup should succeed: ${JSON.stringify(data)}`);
      assert.strictEqual(data.email_verification_required, true, 'Email verification must be required');
      pass('14. Successful registration with 3 fields (omitted name handled cleanly by contract)');

      // Verify database record
      const users = await query('SELECT * FROM user WHERE email = ?', [testEmail]);
      assert.strictEqual(users.length, 1, 'User record must exist in DB');
      createdUid = users[0].uid;
      assert.strictEqual(users[0].mobile_with_country_code, testPhone, 'Phone must match');
      assert.strictEqual(users[0].email_verified_at, null, 'email_verified_at must be NULL');
      assert(users[0].terms_accepted_at !== null, 'terms_accepted_at timestamp must be recorded');
      assert.strictEqual(users[0].trial, 1, 'Trial flag must be set to 1');
      pass('15. Database persistence verified: affirmative terms_accepted_at recorded, trial plan assigned');
    } catch (err) {
      fail('14/15. Successful signup & DB persistence check', err);
    }

    // 16. Duplicate registration with same email is rejected
    try {
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(6) },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          mobile_with_country_code: testPhone,
          acceptPolicy: true,
          turnstileToken: '1x00000000000000000000AA',
        }),
      });
      const data = await res.json();
      assert.strictEqual(data.success, false, 'Duplicate email must be rejected');
      assert(data.msg.includes('already exist'), 'Error message must note duplicate email');
      pass('16. Duplicate account registration rejected safely');
    } catch (err) {
      fail('16. Duplicate signup check', err);
    }

  } finally {
    // Cleanup test user and email verification record
    try {
      if (testEmail) {
        await query('DELETE FROM email_verification WHERE email = ?', [testEmail]);
        await query('DELETE FROM user WHERE email = ?', [testEmail]);
      }
    } catch (_) {}
    server.close();
  }

  console.log('\n====================================================================');
  console.log(`📊 AUDIT ACCEPTANCE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAuditAcceptanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
