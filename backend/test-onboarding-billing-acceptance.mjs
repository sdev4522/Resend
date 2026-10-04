// test-onboarding-billing-acceptance.mjs
import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from './database/dbpromise.js';
import billingRouter from './routes/billing.js';
import { getRazorpayConfig } from './helper/razorpay.js';

const JWTKEY = process.env.JWTKEY || "test_jwt_key_secret_for_tests";
const TEST_PORT = 3199;
const BASE_URL = `http://localhost:${TEST_PORT}/api/billing`;

let passed = 0;
let failed = 0;

function logTest(num, name, condition, details = "") {
  if (condition) {
    console.log(`✅ [PASS] CASE ${num}: ${name}${details ? ` -> ${details}` : ""}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] CASE ${num}: ${name}${details ? ` -> ${details}` : ""}`);
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

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🚀 ACCEPTANCE TEST SUITE: ONBOARDING & BILLING SECURITY VERIFICATION");
  console.log("==================================================================\n");

  // Spin up lightweight Express test server with billing router
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

  // Setup test user in database
  const testEmail = `acceptance_test_${Date.now()}@example.com`;
  const testUid = `test_uid_${Date.now().toString(36)}`;
  
  await query(
    `INSERT INTO user (uid, name, email, password, role, is_blocked, trial, subscription_status, tokenVersion)
     VALUES (?, ?, ?, ?, 'user', 0, 0, NULL, 0)`,
    [testUid, "Test Acceptance User", testEmail, "hashed_pw_test"]
  );

  const token = jwt.sign(
    { uid: testUid, role: "user", tokenVersion: 0 },
    JWTKEY,
    { expiresIn: "2h" }
  );

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const razorpayConfig = await getRazorpayConfig();

  try {
    // -------------------------------------------------------------
    // CASE 9: Billing page and onboarding comparison & database schema
    // -------------------------------------------------------------
    console.log("--- Checking Plan Semantics & Pricing Consistency ---");
    const plansRes = await fetch(`${BASE_URL}/plans`, { headers });
    const plansData = await plansRes.json();

    const freeTrialPlan = plansData.plans.find((p) => p.is_trial === 1 || p.id === 17);
    const premiumPlan = plansData.plans.find((p) => p.id === 15 || p.title.toLowerCase().includes("premium"));
    const platinumPlan = plansData.plans.find((p) => p.id === 16 || p.title.toLowerCase().includes("platinum"));

    logTest(
      9,
      "Consistent Plan Pricing and Durations across Onboarding & Billing",
      freeTrialPlan &&
        Number(freeTrialPlan.price) === 0 &&
        Number(freeTrialPlan.plan_duration_in_days) === 14 &&
        premiumPlan &&
        platinumPlan,
      `Trial: ₹0/14d, Premium: ${premiumPlan?.title} ₹${premiumPlan?.price}, Platinum: ${platinumPlan?.title} ₹${platinumPlan?.price}`
    );

    // -------------------------------------------------------------
    // CASE 1: New user selects FREE TRIAL
    // -------------------------------------------------------------
    console.log("\n--- Testing Free Trial Activation ---");
    const trialRes = await fetch(`${BASE_URL}/activate_trial`, {
      method: "POST",
      headers,
      body: JSON.stringify({ plan_id: freeTrialPlan.id }),
    });
    const trialData = await trialRes.json();

    const [userAfterTrial] = await query(
      `SELECT uid, plan, trial, subscription_status, plan_expire FROM user WHERE uid = ?`,
      [testUid]
    );

    const [orderAfterTrial] = await query(
      `SELECT * FROM orders WHERE uid = ? AND payment_mode = 'FREE_TRIAL'`,
      [testUid]
    );

    const hasTrialingStatus = userAfterTrial?.subscription_status === "trialing";
    const hasTrialFlag = userAfterTrial?.trial === 1;
    const hasPlanAssigned = extractPlanId(userAfterTrial?.plan) === Number(freeTrialPlan.id);
    const hasAuditOrder = orderAfterTrial?.status === "paid" && Number(orderAfterTrial?.amount) === 0;

    logTest(
      1,
      "New user selects FREE TRIAL -> Activates as trialing with 0 payment",
      trialData.success && hasTrialingStatus && hasTrialFlag && hasPlanAssigned && hasAuditOrder,
      `status: ${userAfterTrial?.subscription_status}, trial: ${userAfterTrial?.trial}, expires: ${userAfterTrial?.plan_expire}`
    );

    // Also test: cannot activate trial twice
    const trialRetryRes = await fetch(`${BASE_URL}/activate_trial`, {
      method: "POST",
      headers,
      body: JSON.stringify({ plan_id: freeTrialPlan.id }),
    });
    const trialRetryData = await trialRetryRes.json();
    logTest(
      "1b",
      "Trial cannot be activated more than once per user",
      !trialRetryData.success && trialRetryRes.status === 400,
      trialRetryData.msg
    );

    // -------------------------------------------------------------
    // CASE 2: New user selects Premium (Paid Plan) -> Order created, NOT active
    // -------------------------------------------------------------
    console.log("\n--- Testing Paid Plan Order Creation vs Activation Protection ---");
    const orderRes = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        planId: premiumPlan.id,
        currency: "INR",
        duration_months: 1,
      }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.orderId || orderData.order_id;

    const [userAfterOrder] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterOrder = extractPlanId(userAfterOrder?.plan);

    logTest(
      2,
      "Selecting Premium creates pending order but DOES NOT activate plan",
      orderData.success &&
        orderId &&
        userPlanAfterOrder !== Number(premiumPlan.id) &&
        userAfterOrder.subscription_status !== "active",
      `Order created: ${orderId}, User plan remains: ${userPlanAfterOrder}, status: ${userAfterOrder.subscription_status}`
    );

    // -------------------------------------------------------------
    // CASE 3: User cancels Razorpay Checkout (no verify callback)
    // -------------------------------------------------------------
    console.log("\n--- Testing Razorpay Cancellation / Abandonment ---");
    // Simulate user closing razorpay modal: no verification call is sent
    const [userAfterCancel] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterCancel = extractPlanId(userAfterCancel?.plan);

    logTest(
      3,
      "User cancels Razorpay -> Paid plan is NOT active, user remains trialing",
      userAfterCancel.subscription_status === "trialing" &&
        userPlanAfterCancel === Number(freeTrialPlan.id),
      `User plan is still ${userPlanAfterCancel} (${userAfterCancel.subscription_status})`
    );

    // -------------------------------------------------------------
    // CASE 5: Client sends a fake payment-success callback
    // -------------------------------------------------------------
    console.log("\n--- Testing Tampered / Fake Signature Rejection ---");
    const fakePaymentId = `pay_fake_${Date.now()}`;
    const fakeSignature = "tampered_invalid_signature_hex_1234567890abcdef";

    const fakeVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
        plan_id: premiumPlan.id,
        duration_months: 1,
      }),
    });
    const fakeVerifyData = await fakeVerifyRes.json();

    const [userAfterFake] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterFake = extractPlanId(userAfterFake?.plan);

    logTest(
      5,
      "Fake/Tampered payment signature is REJECTED and plan remains inactive",
      fakeVerifyRes.status === 400 &&
        !fakeVerifyData.success &&
        userPlanAfterFake !== Number(premiumPlan.id) &&
        userAfterFake.subscription_status !== "active",
      `Rejected with status: ${fakeVerifyRes.status}, user status: ${userAfterFake.subscription_status}`
    );

    // -------------------------------------------------------------
    // CASE 4: Payment succeeds with backend-verified HMAC signature
    // -------------------------------------------------------------
    console.log("\n--- Testing Authoritative Payment Verification ---");
    const validPaymentId = `pay_valid_${Date.now()}`;
    const validSignature = crypto
      .createHmac("sha256", razorpayConfig.keySecret)
      .update(`${orderId}|${validPaymentId}`)
      .digest("hex");

    const validVerifyRes = await fetch(`${BASE_URL}/verify_payment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
        plan_id: premiumPlan.id,
        duration_months: 1,
      }),
    });
    const validVerifyData = await validVerifyRes.json();

    const [userAfterVerify] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterVerify = extractPlanId(userAfterVerify?.plan);

    logTest(
      4,
      "Valid payment signature verification activates Premium plan with subscription_status = 'active'",
      validVerifyRes.status === 200 &&
        validVerifyData.success &&
        userPlanAfterVerify === Number(premiumPlan.id) &&
        userAfterVerify.subscription_status === "active" &&
        userAfterVerify.trial === 0,
      `User plan: ${userPlanAfterVerify}, subscription_status: ${userAfterVerify.subscription_status}, trial: ${userAfterVerify.trial}`
    );

    // -------------------------------------------------------------
    // CASE 7: User refreshes after payment (Authoritative persistence)
    // -------------------------------------------------------------
    console.log("\n--- Testing Authoritative State Persistence on Refresh ---");
    const subRes = await fetch(`${BASE_URL}/subscription`, { headers });
    const subData = await subRes.json();

    logTest(
      7,
      "User refreshes -> authoritative subscription status is 'active' with Premium plan",
      subData.success &&
        subData.subscription?.status === "active" &&
        Number(subData.subscription?.plan?.id) === Number(premiumPlan.id),
      `Plan: ${subData.subscription?.plan?.title}, status: ${subData.subscription?.status}`
    );

    // -------------------------------------------------------------
    // CASE 8: User creates Platinum order but never pays
    // -------------------------------------------------------------
    console.log("\n--- Testing Unpaid Platinum Plan Selection ---");
    const platOrderRes = await fetch(`${BASE_URL}/create_order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        planId: platinumPlan.id,
        currency: "INR",
        duration_months: 12,
      }),
    });
    const platOrderData = await platOrderRes.json();
    const platOrderId = platOrderData.orderId || platOrderData.order_id;

    const [userAfterPlatOrder] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterPlat = extractPlanId(userAfterPlatOrder?.plan);

    logTest(
      8,
      "User selects Platinum but never pays -> Platinum MUST NOT become active",
      platOrderData.success &&
        userPlanAfterPlat === Number(premiumPlan.id) &&
        userPlanAfterPlat !== Number(platinumPlan.id),
      `User plan remained: ${userPlanAfterPlat} (Premium), NOT Platinum (${platinumPlan.id})`
    );

    // -------------------------------------------------------------
    // CASE 6: Razorpay webhook arrives asynchronously (order.paid)
    // -------------------------------------------------------------
    console.log("\n--- Testing Webhook Asynchronous Reconciliation ---");
    // Test webhook activation using the pending Platinum order
    const webhookPaymentId = `pay_webhook_${Date.now()}`;
    const webhookPayload = JSON.stringify({
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: platOrderId,
            amount: 79900,
            currency: "INR",
            status: "paid",
            notes: {
              uid: testUid,
              plan_id: String(platinumPlan.id),
              duration_months: "12",
            },
          },
        },
        payment: {
          entity: {
            id: webhookPaymentId,
            order_id: platOrderId,
            amount: 79900,
            status: "captured",
          },
        },
      },
    });

    const webhookSignature = crypto
      .createHmac("sha256", razorpayConfig.webhookSecret)
      .update(webhookPayload)
      .digest("hex");

    const webhookRes = await fetch(`${BASE_URL}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": webhookSignature,
      },
      body: webhookPayload,
    });
    const webhookData = await webhookRes.json();

    const [userAfterWebhook] = await query(
      `SELECT uid, plan, trial, subscription_status FROM user WHERE uid = ?`,
      [testUid]
    );
    const userPlanAfterWebhook = extractPlanId(userAfterWebhook?.plan);

    logTest(
      6,
      "Razorpay webhook order.paid activates subscription safely & idempotently",
      webhookRes.status === 200 &&
        webhookData.success &&
        userPlanAfterWebhook === Number(platinumPlan.id) &&
        userAfterWebhook.subscription_status === "active",
      `User plan updated to Platinum (${userPlanAfterWebhook}), status: ${userAfterWebhook.subscription_status}`
    );

    // Idempotency: Send the webhook a second time
    const webhookRes2 = await fetch(`${BASE_URL}/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": webhookSignature,
      },
      body: webhookPayload,
    });
    const webhookData2 = await webhookRes2.json();
    logTest(
      "6b",
      "Duplicate webhook delivery is handled idempotently without error",
      webhookRes2.status === 200 && webhookData2.success,
      "Duplicate order.paid accepted idempotently"
    );
  } finally {
    // Cleanup test user and test orders
    await query(`DELETE FROM orders WHERE uid = ?`, [testUid]);
    await query(`DELETE FROM user WHERE uid = ?`, [testUid]);
    server.close();
  }

  console.log("\n==================================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite exception:", err);
  process.exit(1);
});
