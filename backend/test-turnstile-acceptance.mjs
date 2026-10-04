/**
 * Cloudflare Turnstile & Signup Protection Acceptance Test Suite
 */
import 'dotenv/config';
import assert from 'assert';
import express from 'express';
import fetch from 'node-fetch';
import { query } from './database/dbpromise.js';
import userRouter from './routes/user.js';
import { verifyTurnstileToken, CLOUDFLARE_TEST_SECRET } from './utils/turnstile.js';

const TEST_PORT = 3198;
const BASE_URL = `http://localhost:${TEST_PORT}/api/user`;

console.log('==================================================================');
console.log('🛡️  CLOUDFLARE TURNSTILE & SIGNUP RATE LIMIT ACCEPTANCE TEST SUITE');
console.log('==================================================================\n');

async function runTests() {
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

  // Spin up test server
  const app = express();
  app.use(express.json());
  app.use('/api/user', userRouter);

  const server = app.listen(TEST_PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    // --- UNIT TESTS FOR TURNSTILE HELPER ---
    console.log('--- Phase 1: Unit Testing Turnstile Siteverify Helper ---');
    
    // 1. Missing token
    try {
      const res = await verifyTurnstileToken({ token: '', clientIp: '127.0.0.1' });
      assert.strictEqual(res.success, false, 'Should fail on empty token');
      assert.strictEqual(res.msg, 'Please complete the security verification.');
      pass('Helper rejects empty token with user-friendly message');
    } catch (err) {
      fail('Helper should reject empty token', err);
    }

    // 2. Invalid / fake token with Cloudflare
    try {
      const res = await verifyTurnstileToken({
        token: 'fake_invalid_token_12345',
        clientIp: '127.0.0.1',
        action: 'signup',
      });
      assert.strictEqual(res.success, false, 'Should fail on invalid token');
      assert.strictEqual(res.msg, 'Security verification failed. Please try again.');
      pass('Helper rejects invalid/forged token via Cloudflare siteverify');
    } catch (err) {
      fail('Helper should reject invalid token', err);
    }

    // --- INTEGRATION TESTS FOR SIGNUP ENDPOINT ---
    console.log('\n--- Phase 2: Testing POST /api/user/signup Endpoint Protection ---');

    const testEmailBase = `test_bot_${Date.now()}`;

    const testIp1 = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const testIp2 = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;
    const testIp3 = `198.51.100.${Math.floor(Math.random() * 200 + 10)}`;

    // 3. Signup with missing Turnstile token
    try {
      const testEmail1 = `${testEmailBase}_notoken@example.com`;
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp1,
        },
        body: JSON.stringify({
          name: 'Bot Attempt',
          email: testEmail1,
          password: 'password123',
          mobile_with_country_code: '+15551234567',
          acceptPolicy: true,
        }),
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Should return HTTP 400');
      assert.strictEqual(data.success, false, 'Should fail');
      assert.strictEqual(data.msg, 'Please complete the security verification.');

      // Verify user was NOT created in DB
      const user = await query('SELECT * FROM user WHERE email = ?', [testEmail1]);
      assert.strictEqual(user.length, 0, 'User must NOT be created when token is missing');
      pass('Endpoint blocks signup without token and prevents user creation');
    } catch (err) {
      fail('Missing token test failed', err);
    }

    // 4. Signup with invalid Turnstile token
    try {
      const testEmail2 = `${testEmailBase}_badtoken@example.com`;
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp2,
        },
        body: JSON.stringify({
          name: 'Bot Attempt 2',
          email: testEmail2,
          password: 'password123',
          mobile_with_country_code: '+15551234567',
          acceptPolicy: true,
          turnstileToken: 'forged_dummy_token_99999',
        }),
      });

      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Should return HTTP 400');
      assert.strictEqual(data.success, false, 'Should fail');
      assert.strictEqual(data.msg, 'Security verification failed. Please try again.');

      // Verify user was NOT created in DB
      const user = await query('SELECT * FROM user WHERE email = ?', [testEmail2]);
      assert.strictEqual(user.length, 0, 'User must NOT be created on invalid token');
      pass('Endpoint blocks signup with invalid token and prevents user creation');
    } catch (err) {
      fail('Invalid token test failed', err);
    }

    // 5. Successful signup with valid Turnstile token
    try {
      const validEmail = `${testEmailBase}_valid@example.com`;
      const res = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp3,
        },
        body: JSON.stringify({
          name: 'Legitimate User',
          email: validEmail,
          password: 'securePassword123!',
          mobile_with_country_code: '+15559876543',
          acceptPolicy: true,
          turnstileToken: 'valid_test_token_success',
        }),
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200 on valid Turnstile token');
      assert.strictEqual(data.success, true, 'Signup should succeed');

      // Verify user was created in DB
      const user = await query('SELECT * FROM user WHERE email = ?', [validEmail]);
      assert.strictEqual(user.length, 1, 'User must be created in DB');
      assert.strictEqual(user[0].email, validEmail);

      pass('Endpoint allows signup with valid Turnstile token and creates user');
    } catch (err) {
      fail('Valid token signup test failed', err);
    }

    // 6. Rate limiting: Burst limit protection (max 2/min)
    console.log('\n--- Phase 3: Testing Rate Limiter Protection ---');
    try {
      const burstIp = `203.0.113.${Math.floor(Math.random() * 200 + 10)}`;
      let rateLimited = false;
      let rateLimitMsg = '';

      // Fire 4 rapid requests from same IP
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${BASE_URL}/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': burstIp,
          },
          body: JSON.stringify({
            name: `Rapid Bot ${i}`,
            email: `${testEmailBase}_rapid${i}@example.com`,
            password: 'password123',
            mobile_with_country_code: '+15551234567',
            acceptPolicy: true,
            turnstileToken: 'test_token',
          }),
        });

        if (res.status === 429) {
          rateLimited = true;
          const data = await res.json();
          rateLimitMsg = data.msg;
          break;
        }
      }

      assert.strictEqual(rateLimited, true, 'Rapid repeat signups must trigger rate limit (HTTP 429)');
      assert.strictEqual(rateLimitMsg, 'Too many signup attempts. Please try again later.');
      pass('Rapid repeated signups blocked by rate limiter with HTTP 429');
    } catch (err) {
      fail('Rate limiter burst test failed', err);
    }
  } finally {
    server.close();
  }

  // Summary
  console.log('\n==================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
