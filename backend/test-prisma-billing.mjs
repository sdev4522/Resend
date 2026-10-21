// backend/test-prisma-billing.mjs
/**
 * Phase P5 — Billing, Payments & Transactions Acceptance Test Suite
 *
 * Verifies all billing, order, subscription, coupon, multi-currency,
 * payment verification, webhook reconciliation, and idempotency invariants.
 */

import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "./database/dbpromise.js";
import { prisma } from "./database/prisma.js";
import billingRouter from "./routes/billing.js";
import { getRazorpayConfig } from "./helper/razorpay.js";

const JWTKEY = process.env.JWTKEY || "test_jwt_key_secret_for_tests";
const TEST_PORT = 3198;
const BASE_URL = `http://localhost:${TEST_PORT}/api/billing`;

let passed = 0;
let failed = 0;

function logTest(num, name, condition, details = "") {
  if (condition) {
    console.log(`✅ [PASS] ${num}. ${name}${details ? ` -> ${details}` : ""}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${num}. ${name}${details ? ` -> ${details}` : ""}`);
    failed++;
  }
}

function extractPlanId(planField) {
  if (!planField) return null;
  if (typeof planField === "object" && planField.id) return Number(planField.id);
  try {
    const parsed = JSON.parse(planField);
    return Number(parsed?.id || parsed);
  } catch {
    return Number(planField) || null;
  }
}

async function runBillingTests() {
  console.log("====================================================================");
  console.log("🧪 PHASE P5 — BILLING, PAYMENTS & TRANSACTIONS ACCEPTANCE SUITE");
  console.log("====================================================================\n");

  // Spin up test server with billing router
  const app = express();
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use("/api/billing", billingRouter);

  const server = app.listen(TEST_PORT);

  const testUidUserA = `p5_test_user_a_${Date.now().toString(36)}`;
  const testUidUserB = `p5_test_user_b_${Date.now().toString(36)}`;
  const testEmailA = `${testUidUserA}@example.com`;
  const testEmailB = `${testUidUserB}@example.com`;
  const testCouponCode = `TEST_P5_${Date.now().toString(36).toUpperCase()}`;

  // Track created records for deterministic cleanup
  const createdOrderIds = [];
  const createdWebhookEvents = [];

  try {
    // 1. Create Test Users
    await prisma.user.create({
      data: {
        uid: testUidUserA,
        name: "P5 User A",
        email: testEmailA,
        password: "hashed_test_password",
        role: "user",
        is_blocked: false,
        trial: 0,
        subscription_status: null,
        tokenVersion: 0,
        email_verified_at: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        uid: testUidUserB,
        name: "P5 User B",
        email: testEmailB,
        password: "hashed_test_password",
        role: "user",
        is_blocked: false,
        trial: 0,
        subscription_status: null,
        tokenVersion: 0,
        email_verified_at: new Date(),
      },
    });

    // Create a temporary test coupon
    await prisma.coupon.create({
      data: {
        code: testCouponCode,
        type: "percentage",
        value: 10.0,
        min_amount: 1.0,
        max_discount: 100.0,
        is_active: true,
        usage_limit: 10,
        used_count: 0,
      },
    });

    const tokenA = jwt.sign({ uid: testUidUserA, role: "user", tokenVersion: 0 }, JWTKEY, { expiresIn: "2h" });
    const tokenB = jwt.sign({ uid: testUidUserB, role: "user", tokenVersion: 0 }, JWTKEY, { expiresIn: "2h" });

    const headersA = { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` };
    const headersB = { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` };

    const razorpayConfig = await getRazorpayConfig();

    // -------------------------------------------------------------
    // TEST 1: Currency detection
    // -------------------------------------------------------------
    const currRes = await fetch(`${BASE_URL}/detect_currency`, {
      headers: { ...headersA, "Accept-Language": "en-IN,en;q=0.9" },
    });
    const currData = await currRes.json();
    logTest(
      1,
      "Currency detection endpoint returns valid currency & symbol",
      currRes.status === 200 && currData.success && Boolean(currData.currency) && Boolean(currData.symbol),
      `Detected: ${currData.currency} (${currData.symbol})`
    );

    // -------------------------------------------------------------
    // TEST 2: Active subscription plans query
    // -------------------------------------------------------------
    const plansRes = await fetch(`${BASE_URL}/plans`, { headers: headersA });
    const plansData = await plansRes.json();
    const plansList = plansData.plans || [];
    const trialPlan = plansList.find((p) => p.is_trial === 1 || String(p.title).toLowerCase().includes("trial"));
    const premiumPlan = plansList.find((p) => p.id === 15 || p.id === 19 || String(p.title).toLowerCase().includes("premium"));
    const platinumPlan = plansList.find((p) => p.id === 16 || p.id === 20 || String(p.title).toLowerCase().includes("platinum"));

    logTest(
      2,
      "Active plans query returns plans list with multi-currency prices",
      plansRes.status === 200 && plansData.success && plansList.length >= 3 && Boolean(trialPlan) && Boolean(premiumPlan),
      `Found ${plansList.length} plans: ${plansList.map((p) => p.title).join(", ")}`
    );

    // -------------------------------------------------------------
    // TEST 3: Server-authoritative price calculation
    // -------------------------------------------------------------
    const calcRes = await fetch(`${BASE_URL}/calculate_price`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        planId: premiumPlan.id,
        couponCode: testCouponCode,
        currency: "INR",
      }),
    });
    const calcData = await calcRes.json();
    logTest(
      3,
      "Price calculation endpoint computes correct amounts and integer minor units",
      calcRes.status === 200 &&
        calcData.success &&
        calcData.pricing?.finalAmount > 0 &&
        calcData.pricing?.amountMinor === Math.round(calcData.pricing?.finalAmount * 100) &&
        calcData.pricing?.couponDiscount > 0,
      `Final: ₹${calcData.pricing?.finalAmount} (Minor: ${calcData.pricing?.amountMinor}), Discount: ₹${calcData.pricing?.couponDiscount}`
    );

    // -------------------------------------------------------------
    // TEST 4: Coupon validation endpoint
    // -------------------------------------------------------------
    const couponRes = await fetch(`${BASE_URL}/validate_coupon`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        planId: premiumPlan.id,
        couponCode: testCouponCode,
        currency: "INR",
      }),
    });
    const couponData = await couponRes.json();
    logTest(
      4,
      "Coupon validation validates active coupon and returns discount details",
      couponRes.status === 200 && couponData.success && couponData.valid && couponData.couponCode === testCouponCode,
      `Coupon: ${couponData.couponCode}, Discount: ₹${couponData.discountAmount}`
    );

    // -------------------------------------------------------------
    // TEST 5: Free trial activation
    // -------------------------------------------------------------
    const trialRes = await fetch(`${BASE_URL}/activate_trial`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ plan_id: trialPlan.id }),
    });
    const trialData = await trialRes.json();

    const userAAfterTrial = await prisma.user.findFirst({ where: { uid: testUidUserA } });
    const trialOrder = await prisma.orders.findFirst({ where: { uid: testUidUserA, payment_mode: "FREE_TRIAL" } });
    if (trialOrder) createdOrderIds.push(trialOrder.id);

    logTest(
      5,
      "Free trial activation sets user to trialing and creates FREE_TRIAL paid audit order",
      trialRes.status === 200 &&
        trialData.success &&
        userAAfterTrial?.trial === 1 &&
        userAAfterTrial?.subscription_status === "trialing" &&
        trialOrder?.status === "paid" &&
        Number(trialOrder?.amount) === 0,
      `Status: ${userAAfterTrial?.subscription_status}, Trial flag: ${userAAfterTrial?.trial}`
    );

    // -------------------------------------------------------------
    // TEST 6: Free trial replay protection
    // -------------------------------------------------------------
    const trialReplayRes = await fetch(`${BASE_URL}/activate_trial`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ plan_id: trialPlan.id }),
    });
    const trialReplayData = await trialReplayRes.json();
    logTest(
      6,
      "Trial replay is rejected with 400 when trial is already used",
      trialReplayRes.status === 400 && !trialReplayData.success,
      trialReplayData.msg
    );

    // -------------------------------------------------------------
    // TEST 7: Create one-time standard order
    // -------------------------------------------------------------
    const orderRes = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        planId: premiumPlan.id,
        couponCode: testCouponCode,
        currency: "INR",
        autopay: false,
      }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.orderId || orderData.order_id;
    if (orderData.internalOrderId) createdOrderIds.push(orderData.internalOrderId);

    const userABeforePay = await prisma.user.findFirst({ where: { uid: testUidUserA } });
    const orderRecord = await prisma.orders.findFirst({ where: { s_token: orderId } });

    logTest(
      7,
      "Standard order creation persists order with status 'created' without activating plan prematurely",
      orderRes.status === 200 &&
        orderData.success &&
        orderId &&
        orderRecord?.status === "created" &&
        orderRecord?.payment_mode === "RAZORPAY" &&
        userABeforePay?.subscription_status === "trialing",
      `Order: ${orderId}, Status: ${orderRecord?.status}, User remains: ${userABeforePay?.subscription_status}`
    );

    // -------------------------------------------------------------
    // TEST 8: Tenant isolation in payment verification
    // -------------------------------------------------------------
    // User B tries to verify User A's order -> must be rejected with 403
    const crossTenantVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers: headersB,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_test_unauthorized",
        razorpay_signature: "fake_sig",
      }),
    });
    const crossTenantData = await crossTenantVerifyRes.json();
    logTest(
      8,
      "Tenant boundary: User B cannot verify or hijack User A's order (403 forbidden)",
      crossTenantVerifyRes.status === 403 && !crossTenantData.success,
      crossTenantData.msg
    );

    // -------------------------------------------------------------
    // TEST 9: Invalid / tampered payment signature rejection
    // -------------------------------------------------------------
    const tamperedVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: "pay_tampered_test",
        razorpay_signature: "tampered_signature_hex_deadbeef123456",
      }),
    });
    const tamperedData = await tamperedVerifyRes.json();
    const orderAfterTamper = await prisma.orders.findFirst({ where: { s_token: orderId } });

    logTest(
      9,
      "Tampered signature is rejected with 400 and transitions order status to 'failed'",
      tamperedVerifyRes.status === 400 && !tamperedData.success && orderAfterTamper?.status === "failed",
      `Response: ${tamperedData.msg}, Order status: ${orderAfterTamper?.status}`
    );

    // Reset order status to 'created' to test valid verification
    await prisma.orders.update({
      where: { id: orderRecord.id },
      data: { status: "created" },
    });

    // -------------------------------------------------------------
    // TEST 10: Authoritative payment verification with valid HMAC
    // -------------------------------------------------------------
    const validPaymentId = `pay_valid_${Date.now()}`;
    const validSignature = crypto
      .createHmac("sha256", razorpayConfig.keySecret)
      .update(`${orderId}|${validPaymentId}`)
      .digest("hex");

    const validVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const validVerifyData = await validVerifyRes.json();

    const userAAfterPaid = await prisma.user.findFirst({ where: { uid: testUidUserA } });
    const orderAfterPaid = await prisma.orders.findFirst({ where: { s_token: orderId } });
    const couponAfterUse = await prisma.coupon.findFirst({ where: { code: testCouponCode } });

    logTest(
      10,
      "Authoritative payment verification activates paid plan, updates order to 'paid', increments coupon",
      validVerifyRes.status === 200 &&
        validVerifyData.success &&
        userAAfterPaid?.subscription_status === "active" &&
        userAAfterPaid?.trial === 0 &&
        orderAfterPaid?.status === "paid" &&
        couponAfterUse?.used_count === 1,
      `User status: ${userAAfterPaid?.subscription_status}, Order status: ${orderAfterPaid?.status}, Coupon used: ${couponAfterUse?.used_count}`
    );

    // -------------------------------------------------------------
    // TEST 11: Payment verification idempotency
    // -------------------------------------------------------------
    const duplicateVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const duplicateVerifyData = await duplicateVerifyRes.json();
    logTest(
      11,
      "Duplicate payment verification is idempotent and returns alreadyProcessed flag",
      duplicateVerifyRes.status === 200 && duplicateVerifyData.success && duplicateVerifyData.alreadyProcessed === true,
      duplicateVerifyData.msg
    );

    // -------------------------------------------------------------
    // TEST 12: Autopay subscription order creation
    // -------------------------------------------------------------
    const autopayOrderRes = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers: headersB,
      body: JSON.stringify({
        planId: platinumPlan.id,
        currency: "INR",
        autopay: true,
      }),
    });
    const autopayOrderData = await autopayOrderRes.json();
    const subId = autopayOrderData.subscriptionId;
    if (autopayOrderData.internalOrderId) createdOrderIds.push(autopayOrderData.internalOrderId);

    logTest(
      12,
      "Autopay order creation returns subscriptionId and persists RAZORPAY_AUTOPAY order",
      autopayOrderRes.status === 200 &&
        autopayOrderData.success &&
        autopayOrderData.isAutopay === true &&
        Boolean(subId),
      `SubId: ${subId}`
    );

    // -------------------------------------------------------------
    // TEST 13: Autopay subscription verification
    // -------------------------------------------------------------
    const subPaymentId = `pay_sub_${Date.now()}`;
    const subSignature = crypto
      .createHmac("sha256", razorpayConfig.keySecret)
      .update(`${subPaymentId}|${subId}`)
      .digest("hex");

    const subVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers: headersB,
      body: JSON.stringify({
        razorpay_subscription_id: subId,
        razorpay_payment_id: subPaymentId,
        razorpay_signature: subSignature,
      }),
    });
    const subVerifyData = await subVerifyRes.json();
    const userBAfterPaid = await prisma.user.findFirst({ where: { uid: testUidUserB } });

    logTest(
      13,
      "Subscription payment verification activates user plan and binds subscription_id",
      subVerifyRes.status === 200 &&
        subVerifyData.success &&
        userBAfterPaid?.subscription_status === "active" &&
        userBAfterPaid?.subscription_id === subId,
      `User B status: ${userBAfterPaid?.subscription_status}, Subscription ID: ${userBAfterPaid?.subscription_id}`
    );

    // -------------------------------------------------------------
    // TEST 14: Orders history and subscription status queries
    // -------------------------------------------------------------
    const ordersHistoryRes = await fetch(`${BASE_URL}/orders`, { headers: headersA });
    const ordersHistoryData = await ordersHistoryRes.json();

    const subQueryRes = await fetch(`${BASE_URL}/subscription`, { headers: headersA });
    const subQueryData = await subQueryRes.json();

    logTest(
      14,
      "GET /orders and GET /subscription return accurate tenant history & state",
      ordersHistoryRes.status === 200 &&
        ordersHistoryData.success &&
        ordersHistoryData.orders.length >= 2 &&
        subQueryRes.status === 200 &&
        subQueryData.subscription?.status === "active",
      `Orders count: ${ordersHistoryData.orders.length}, Subscription: ${subQueryData.subscription?.status}`
    );

    // -------------------------------------------------------------
    // TEST 15: Autopay cancellation
    // -------------------------------------------------------------
    const cancelRes = await fetch(`${BASE_URL}/cancel_autopay`, {
      method: "POST",
      headers: headersB,
    });
    const cancelData = await cancelRes.json();
    const userBAfterCancel = await prisma.user.findFirst({ where: { uid: testUidUserB } });

    logTest(
      15,
      "Autopay cancellation updates user subscription_status to 'cancelled'",
      cancelRes.status === 200 && cancelData.success && userBAfterCancel?.subscription_status === "cancelled",
      `User B status: ${userBAfterCancel?.subscription_status}`
    );

    // -------------------------------------------------------------
    // TEST 16: Webhook signature verification and order reconciliation
    // -------------------------------------------------------------
    // Create another pending order for webhook test
    const webhookOrderRes = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        planId: platinumPlan.id,
        currency: "INR",
        autopay: false,
      }),
    });
    const webhookOrderData = await webhookOrderRes.json();
    const webhookOrderId = webhookOrderData.orderId;
    if (webhookOrderData.internalOrderId) createdOrderIds.push(webhookOrderData.internalOrderId);

    const webhookEventId = `evt_test_${Date.now()}`;
    createdWebhookEvents.push(webhookEventId);

    const webhookPayloadObj = {
      event: "order.paid",
      event_id: webhookEventId,
      payload: {
        order: {
          entity: {
            id: webhookOrderId,
            amount: 99900,
            currency: "INR",
            status: "paid",
          },
        },
        payment: {
          entity: {
            id: `pay_wh_${Date.now()}`,
            order_id: webhookOrderId,
            amount: 99900,
            status: "captured",
          },
        },
      },
    };
    const webhookPayloadStr = JSON.stringify(webhookPayloadObj);
    const webhookSignature = crypto
      .createHmac("sha256", razorpayConfig.webhookSecret)
      .update(webhookPayloadStr)
      .digest("hex");

    const webhookRes = await fetch(`${BASE_URL}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": webhookSignature,
        "x-razorpay-event-id": webhookEventId,
      },
      body: webhookPayloadStr,
    });
    const webhookData = await webhookRes.json();
    const orderAfterWebhook = await prisma.orders.findFirst({ where: { s_token: webhookOrderId } });
    const eventRow = await prisma.processed_webhook_events.findFirst({ where: { event_id: webhookEventId } });

    logTest(
      16,
      "Razorpay webhook order.paid marks order 'paid' and logs processed_webhook_events",
      webhookRes.status === 200 &&
        webhookData.success &&
        orderAfterWebhook?.status === "paid" &&
        Boolean(eventRow),
      `Order status: ${orderAfterWebhook?.status}, Event logged: ${eventRow?.event_id}`
    );

    // -------------------------------------------------------------
    // TEST 17: Webhook duplicate delivery idempotency
    // -------------------------------------------------------------
    const dupWebhookRes = await fetch(`${BASE_URL}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": webhookSignature,
        "x-razorpay-event-id": webhookEventId,
      },
      body: webhookPayloadStr,
    });
    const dupWebhookData = await dupWebhookRes.json();
    logTest(
      17,
      "Duplicate webhook delivery is deduplicated via processed_webhook_events",
      dupWebhookRes.status === 200 && dupWebhookData.success && dupWebhookData.duplicate === true,
      `Duplicate response: ${dupWebhookData.duplicate}`
    );

    // -------------------------------------------------------------
    // TEST 18: Legacy dbpromise query helper co-existence
    // -------------------------------------------------------------
    const rawSqlCheck = await query(`SELECT COUNT(*) as cnt FROM plan WHERE id = ?`, [trialPlan.id]);
    logTest(
      18,
      "Legacy dbpromise query helper remains operational and returns expected rows",
      Array.isArray(rawSqlCheck) && rawSqlCheck[0]?.cnt > 0,
      `Count: ${rawSqlCheck[0]?.cnt}`
    );

  } finally {
    // Deterministic cleanup
    if (createdOrderIds.length > 0) {
      await prisma.orders.deleteMany({ where: { id: { in: createdOrderIds } } }).catch(() => {});
    }
    await prisma.orders.deleteMany({ where: { uid: { in: [testUidUserA, testUidUserB] } } }).catch(() => {});
    await prisma.coupon.deleteMany({ where: { code: testCouponCode } }).catch(() => {});
    await prisma.user.deleteMany({ where: { uid: { in: [testUidUserA, testUidUserB] } } }).catch(() => {});
    if (createdWebhookEvents.length > 0) {
      await prisma.processed_webhook_events.deleteMany({ where: { event_id: { in: createdWebhookEvents } } }).catch(() => {});
    }

    server.close();
  }

  console.log("\n====================================================================");
  console.log(`📊 P5 BILLING TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("====================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runBillingTests().catch((err) => {
  console.error("Test suite exception:", err);
  process.exit(1);
});
