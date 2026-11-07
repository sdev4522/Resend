/**
 * Automated Test Suite for Dodo Payments Webhook Handlers
 * Tests:
 * 1. payment.succeeded event verification and execution
 * 2. subscription.active event verification and execution
 * 3. Idempotent deduplication of replayed webhooks
 * 4. Forged / invalid signature rejection (401 Unauthorized)
 * 5. Tampered payload rejection (401 Unauthorized)
 * 6. Missing header validation (400 Bad Request)
 * 7. Unhandled event acknowledgment (200 OK with unhandled_event status)
 * 8. Custom webhook listener callback invocation
 */

import { Webhook } from 'standardwebhooks';
import assert from 'node:assert';

const TEST_SECRET = 'whsec_' + Buffer.from('test_dodo_webhook_secret_key_987654321').toString('base64');
process.env.DODO_PAYMENTS_WEBHOOK_KEY = TEST_SECRET;

async function runTests() {
  console.log('🧪 Starting Dodo Payments Webhook Handler Test Suite...\n');

  // Dynamic import of modules after env var is set
  const { POST } = await import('./app/api/webhooks/dodo/route.js');
  const { POST: AliasPOST } = await import('./app/api/webhook/dodo/route.js');
  const { registerDodoWebhookListener, clearIdempotencyCache } = await import('./lib/dodo/index.js');

  const wh = new Webhook(TEST_SECRET);

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  }

  function recordFail(testName, err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(err);
    failed++;
  }

  // Helper to build NextRequest-like object
  function createMockRequest(url, { headers = {}, body = '' }) {
    const headerMap = new Map();
    for (const [k, v] of Object.entries(headers)) {
      headerMap.set(k.toLowerCase(), v);
    }

    return {
      url,
      headers: {
        get: (key) => headerMap.get(key.toLowerCase()) || null,
      },
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  }

  // --- TEST 1: payment.succeeded valid webhook ---
  try {
    clearIdempotencyCache();
    const eventId = 'evt_pay_test_001';
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'payment.succeeded',
      timestamp: now.toISOString(),
      data: {
        payload_type: 'Payment',
        payment_id: 'pay_dodo_999',
        status: 'succeeded',
        currency: 'USD',
        total_amount: 4900,
        customer: {
          customer_id: 'cus_dodo_111',
          email: 'alex@example.com',
          name: 'Alex Johnson',
        },
        metadata: {
          planId: 2,
          billingDuration: 'monthly',
        },
      },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
        'content-type': 'application/json',
      },
      body: payload,
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.event, 'payment.succeeded');
    assert.strictEqual(data.id, eventId);
    assert.strictEqual(data.details?.paymentId, 'pay_dodo_999');
    assert.strictEqual(data.details?.customerEmail, 'alex@example.com');

    recordPass('payment.succeeded valid webhook processed successfully');
  } catch (err) {
    recordFail('payment.succeeded valid webhook', err);
  }

  // --- TEST 2: subscription.active valid webhook ---
  try {
    const eventId = 'evt_sub_test_002';
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'subscription.active',
      timestamp: now.toISOString(),
      data: {
        payload_type: 'Subscription',
        subscription_id: 'sub_dodo_777',
        status: 'active',
        currency: 'USD',
        recurring_price: 9900,
        billing_interval: 'month',
        billing_frequency: 1,
        customer: {
          customer_id: 'cus_dodo_222',
          email: 'sarah@example.com',
          name: 'Sarah Connor',
        },
        product_id: 'prod_pro_plan',
        next_billing_date: '2026-11-21T00:00:00Z',
        metadata: {
          workspaceId: 'ws_987',
        },
      },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
        'content-type': 'application/json',
      },
      body: payload,
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.event, 'subscription.active');
    assert.strictEqual(data.id, eventId);
    assert.strictEqual(data.details?.subscriptionId, 'sub_dodo_777');
    assert.strictEqual(data.details?.customerEmail, 'sarah@example.com');
    assert.strictEqual(data.details?.status, 'active');

    recordPass('subscription.active valid webhook processed successfully');
  } catch (err) {
    recordFail('subscription.active valid webhook', err);
  }

  // --- TEST 3: Idempotent duplicate event skipping ---
  try {
    const eventId = 'evt_sub_test_002'; // Same ID as test 2
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'subscription.active',
      data: { subscription_id: 'sub_dodo_777' },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.duplicate, true);

    recordPass('Duplicate webhook delivery recognized and skipped idempotently');
  } catch (err) {
    recordFail('Idempotent duplicate event', err);
  }

  // --- TEST 4: Invalid signature rejection ---
  try {
    const eventId = 'evt_forged_003';
    const now = new Date();
    const payload = JSON.stringify({ type: 'payment.succeeded' });
    const forgedSignature = 'v1,bm90X2FfdmFsaWRfc2lnbmF0dXJlX2F0X2FsbA==';

    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': forgedSignature,
      },
      body: payload,
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    assert.strictEqual(data.success, false);

    recordPass('Forged webhook signature strictly rejected with 401 Unauthorized');
  } catch (err) {
    recordFail('Invalid signature rejection', err);
  }

  // --- TEST 5: Tampered payload rejection ---
  try {
    const eventId = 'evt_tampered_004';
    const now = new Date();
    const originalPayload = JSON.stringify({ type: 'payment.succeeded', total_amount: 100 });
    const tamperedPayload = JSON.stringify({ type: 'payment.succeeded', total_amount: 999999 });

    // Sign original, send tampered
    const signature = wh.sign(eventId, now, originalPayload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body: tamperedPayload,
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);

    recordPass('Tampered payload signature mismatch rejected with 401');
  } catch (err) {
    recordFail('Tampered payload rejection', err);
  }

  // --- TEST 6: Missing required headers ---
  try {
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': 'evt_missing_headers',
      },
      body: '{}',
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
    assert.strictEqual(data.success, false);

    recordPass('Missing headers rejected with 400 Bad Request');
  } catch (err) {
    recordFail('Missing headers rejection', err);
  }

  // --- TEST 7: Unhandled event acknowledgment ---
  try {
    const eventId = 'evt_unhandled_007';
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'dispute.opened',
      data: { dispute_id: 'dsp_123' },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.status, 'unhandled_event');

    recordPass('Unhandled event gracefully acknowledged with 200 OK');
  } catch (err) {
    recordFail('Unhandled event acknowledgment', err);
  }

  // --- TEST 8: Custom event listener callback invocation ---
  try {
    let listenerCalled = false;
    let receivedPaymentId = null;

    const unsubscribe = registerDodoWebhookListener('payment.succeeded', async (event, context) => {
      listenerCalled = true;
      receivedPaymentId = event.data.payment_id;
    });

    const eventId = 'evt_listener_008';
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'payment.succeeded',
      timestamp: now.toISOString(),
      data: {
        payload_type: 'Payment',
        payment_id: 'pay_custom_hook_456',
        status: 'succeeded',
        currency: 'USD',
        total_amount: 1500,
        customer: { email: 'hook@example.com' },
      },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhooks/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(listenerCalled, true, 'Expected custom listener to be called');
    assert.strictEqual(receivedPaymentId, 'pay_custom_hook_456');

    unsubscribe();
    recordPass('Custom webhook listener successfully triggered');
  } catch (err) {
    recordFail('Custom listener invocation', err);
  }

  // --- TEST 9: Alias route /api/webhook/dodo functions identically ---
  try {
    const eventId = 'evt_alias_009';
    const now = new Date();
    const payload = JSON.stringify({
      business_id: 'bus_test123',
      type: 'payment.succeeded',
      timestamp: now.toISOString(),
      data: {
        payload_type: 'Payment',
        payment_id: 'pay_alias_009',
        status: 'succeeded',
        currency: 'USD',
        total_amount: 2500,
        customer: { email: 'alias@example.com' },
      },
    });

    const signature = wh.sign(eventId, now, payload);
    const req = createMockRequest('http://localhost:3000/api/webhook/dodo', {
      headers: {
        'webhook-id': eventId,
        'webhook-timestamp': String(Math.floor(now.getTime() / 1000)),
        'webhook-signature': signature,
      },
      body: payload,
    });

    const res = await AliasPOST(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.received, true);
    assert.strictEqual(data.event, 'payment.succeeded');
    assert.strictEqual(data.id, eventId);

    recordPass('Alias route /api/webhook/dodo responds identically');
  } catch (err) {
    recordFail('Alias route verification', err);
  }

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
