const express = require("express");
const router = express.Router();
const validateUser = require("../middlewares/user.js");
const { query } = require("../database/dbpromise");
const { updateUserPlan } = require("../functions/function");
const {
  validateCoupon,
  calculateCheckoutPrice,
  getCurrencySettings,
  applySmartRounding,
  DURATION_DISCOUNT_RATES,
} = require("../helper/pricing");
const {
  getRazorpayConfig,
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  verifyRazorpaySignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
} = require("../helper/razorpay");
const { activateUserPlan } = require("../helper/entitlements");
const logger = require("../utils/logger");

const COUNTRY_TO_CURRENCY = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  UK: "GBP",
  AE: "AED",
  CA: "CAD",
  AU: "AUD",
  SG: "SGD",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  IE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
};

/**
 * GET /api/billing/detect_currency
 * Inspects GeoIP headers or Accept-Language to detect country and suggested currency.
 */
router.get("/detect_currency", async (req, res) => {
  try {
    const { supportedCurrencies } = await getCurrencySettings();
    const enabledCurrencies = supportedCurrencies.filter((c) => c.enabled !== false);

    // 1. Check IP headers (Cloudflare, Vercel, standard headers)
    const rawCountry = (
      req.headers["cf-ipcountry"] ||
      req.headers["x-vercel-ip-country"] ||
      req.headers["x-country-code"] ||
      ""
    ).trim().toUpperCase();

    let detectedCurrency = null;
    let detectionSource = "default";

    if (rawCountry && COUNTRY_TO_CURRENCY[rawCountry]) {
      detectedCurrency = COUNTRY_TO_CURRENCY[rawCountry];
      detectionSource = "geoip";
    }

    // 2. If not detected via GeoIP, check Accept-Language
    if (!detectedCurrency) {
      const acceptLang = (req.headers["accept-language"] || "").toLowerCase();
      if (acceptLang.includes("en-in") || acceptLang.includes("hi")) {
        detectedCurrency = "INR";
        detectionSource = "locale";
      } else if (acceptLang.includes("en-gb")) {
        detectedCurrency = "GBP";
        detectionSource = "locale";
      } else if (acceptLang.includes("ar-ae") || acceptLang.includes("ar")) {
        detectedCurrency = "AED";
        detectionSource = "locale";
      } else if (
        acceptLang.includes("de") ||
        acceptLang.includes("fr") ||
        acceptLang.includes("es") ||
        acceptLang.includes("it")
      ) {
        detectedCurrency = "EUR";
        detectionSource = "locale";
      }
    }

    // 3. Fallback to USD
    if (!detectedCurrency) {
      detectedCurrency = "USD";
      detectionSource = "fallback";
    }

    // Ensure detected currency is actually enabled on this site
    const matched = enabledCurrencies.find(
      (c) => c.code.toUpperCase() === detectedCurrency.toUpperCase()
    );

    const finalCurrency = matched ? matched.code : (enabledCurrencies[0]?.code || "USD");
    const currencyObj = supportedCurrencies.find((c) => c.code.toUpperCase() === finalCurrency);

    res.json({
      success: true,
      currency: finalCurrency,
      symbol: currencyObj?.symbol || "$",
      country: rawCountry || null,
      source: detectionSource,
    });
  } catch (err) {
    logger.error("[Billing] Error detecting currency:", err);
    res.json({ success: true, currency: "USD", symbol: "$", source: "fallback" });
  }
});

/**
 * GET /api/billing/plans
 * Returns active subscription plans and supported currencies with clean currencyPrices from plan_prices
 */
router.get("/plans", async (req, res) => {
  try {
    const plans = await query(
      `SELECT * FROM plan ORDER BY is_trial DESC, price ASC`
    );

    const allPrices = await query(
      `SELECT * FROM plan_prices WHERE is_active = 1`
    );

    const { baseCode, baseSymbol, supportedCurrencies, roundingMode } = await getCurrencySettings();

    const formattedPlans = plans.map((p) => {
      let customObj = null;
      if (p.custom) {
        try {
          customObj = typeof p.custom === "string" ? JSON.parse(p.custom) : p.custom;
        } catch (e) {}
      }

      const planPrices = allPrices.filter((row) => row.plan_id === p.id);
      const currencyPrices = {};
      const currencyStrikePrices = {};

      for (const c of supportedCurrencies) {
        const foundRow = planPrices.find((row) => row.currency_code.toUpperCase() === c.code.toUpperCase());
        if (foundRow) {
          currencyPrices[c.code] = parseFloat(foundRow.amount);
          if (foundRow.strike_amount) {
            currencyStrikePrices[c.code] = parseFloat(foundRow.strike_amount);
          }
        } else if (c.code === baseCode) {
          currencyPrices[c.code] = parseFloat(p.price || 0);
          if (p.price_strike) currencyStrikePrices[c.code] = parseFloat(p.price_strike);
        } else {
          // Fallback conversion with smart SaaS rounding
          currencyPrices[c.code] = applySmartRounding(
            parseFloat(p.price || 0) * (parseFloat(c.rate) || 1.0),
            c.code,
            roundingMode
          );
          if (p.price_strike) {
            currencyStrikePrices[c.code] = applySmartRounding(
              parseFloat(p.price_strike) * (parseFloat(c.rate) || 1.0),
              c.code,
              roundingMode
            );
          }
        }
      }

      return {
        ...p,
        custom: customObj,
        plan_prices: planPrices,
        currencyPrices,
        currencyStrikePrices,
      };
    });

    res.json({
      success: true,
      plans: formattedPlans,
      currency: baseCode,
      currencySymbol: baseSymbol,
      supportedCurrencies,
      durationDiscounts: DURATION_DISCOUNT_RATES,
    });
  } catch (err) {
    logger.error("[Billing] Error fetching plans:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch plans" });
  }
});

/**
 * POST /api/billing/activate_trial
 * Activates 14-day free trial for authenticated user.
 * Authoritative backend state: trial = 1, subscription_status = 'trialing'.
 */
router.post("/activate_trial", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;

    const [user] = await query(`SELECT * FROM user WHERE uid = ? LIMIT 1`, [uid]);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Check if user has active paid subscription
    if (
      user.subscription_status === "active" &&
      user.plan_expire &&
      Number(user.plan_expire) > Date.now() &&
      !user.trial
    ) {
      return res.status(400).json({
        success: false,
        msg: "You already have an active paid subscription.",
      });
    }

    // Check if user has already used their trial
    const trialOrders = await query(
      `SELECT id FROM orders WHERE uid = ? AND payment_mode = 'FREE_TRIAL' LIMIT 1`,
      [uid]
    );
    if (user.trial === 1 || trialOrders.length > 0) {
      return res.status(400).json({
        success: false,
        msg: "You have already used your free trial.",
      });
    }

    // Find Trial plan (is_trial = 1 or title like Trial)
    const [trialPlan] = await query(
      `SELECT * FROM plan WHERE is_trial = 1 OR LOWER(title) LIKE '%trial%' ORDER BY id ASC LIMIT 1`
    );

    if (!trialPlan) {
      return res.status(500).json({
        success: false,
        msg: "No trial plan configured in system",
      });
    }

    const trialDays = parseInt(trialPlan.plan_duration_in_days || 14, 10);
    const newExpiry = await updateUserPlan(trialPlan, uid, trialDays, false);

    await query(
      `UPDATE user SET trial = 1, subscription_status = 'trialing' WHERE uid = ?`,
      [uid]
    );

    // Record order audit trail
    await query(
      `INSERT INTO orders (uid, payment_mode, amount, data, s_token, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uid,
        "FREE_TRIAL",
        "0.00",
        JSON.stringify({ plan: trialPlan, isTrial: true, durationDays: trialDays }),
        `trial_${uid.slice(0, 8)}_${Date.now()}`,
        "paid",
      ]
    );

    res.json({
      success: true,
      msg: "14-day free trial activated successfully!",
      plan: trialPlan,
      subscription_status: "trialing",
      newExpiry,
    });
  } catch (err) {
    logger.error("[Billing] Activate trial error:", err);
    res.status(500).json({ success: false, msg: err.message || "Failed to activate trial" });
  }
});

/**
 * POST /api/billing/calculate_price
 * Server-authoritative price calculation endpoint.
 */
router.post("/calculate_price", validateUser, async (req, res) => {
  try {
    const { planId, couponCode, currency } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, msg: "planId is required" });
    }

    const priceSummary = await calculateCheckoutPrice({
      planId,
      durationMonths: 1,
      couponCode: couponCode || null,
      targetCurrency: currency || null,
    });

    res.json({
      success: true,
      pricing: priceSummary,
    });
  } catch (err) {
    logger.error("[Billing] Price calculation error:", err);
    res.status(400).json({ success: false, msg: err.message || "Failed to calculate price" });
  }
});

/**
 * POST /api/billing/validate_coupon
 * Validates a coupon against a plan and optional target currency.
 */
router.post("/validate_coupon", validateUser, async (req, res) => {
  try {
    const { planId, couponCode, currency } = req.body;
    if (!planId || !couponCode) {
      return res.status(400).json({ success: false, msg: "planId and couponCode are required" });
    }

    const priceSummary = await calculateCheckoutPrice({
      planId,
      durationMonths: 1,
      couponCode,
      targetCurrency: currency || null,
    });

    if (priceSummary.couponCode) {
      res.json({
        success: true,
        valid: true,
        couponCode: priceSummary.couponCode,
        discountAmount: priceSummary.couponDiscount,
        message: priceSummary.couponMessage || "Coupon applied successfully",
        pricing: priceSummary,
      });
    } else {
      res.status(400).json({
        success: false,
        valid: false,
        msg: priceSummary.couponMessage || "Invalid or inapplicable coupon",
      });
    }
  } catch (err) {
    logger.error("[Billing] Coupon validation error:", err);
    res.status(400).json({ success: false, msg: err.message || "Failed to validate coupon" });
  }
});

/**
 * POST /api/billing/create_order
 * Creates an authoritative Razorpay order or Autopay Subscription.
 */
router.post("/create_order", validateUser, async (req, res) => {
  try {
    const planId = req.body.planId || req.body.plan_id;
    const { couponCode, currency } = req.body;
    const autopay = req.body.autopay === true;
    const uid = req.decode.uid;

    if (!planId) {
      return res.status(400).json({ success: false, msg: "planId is required" });
    }

    // Authoritative calculation
    const priceSummary = await calculateCheckoutPrice({
      planId,
      durationMonths: 1,
      couponCode: couponCode || null,
      targetCurrency: currency || null,
    });

    const config = await getRazorpayConfig();
    const receiptId = `rcpt_${uid.slice(0, 8)}_${Date.now()}`;

    // 1. AUTOPAY RECURRING SUBSCRIPTION FLOW
    if (autopay) {
      // Create or get recurring plan on Razorpay
      const rzPlan = await createRazorpayPlan({
        name: priceSummary.plan.title,
        amountMinor: priceSummary.amountMinor,
        currency: priceSummary.currency,
        period: "monthly",
        interval: 1,
      });

      // Create Razorpay subscription
      const rzSub = await createRazorpaySubscription({
        planId: rzPlan.id,
        totalCount: 60,
        customerNotify: 1,
        notes: {
          uid,
          planId: String(planId),
          couponCode: priceSummary.couponCode || "",
          receipt: receiptId,
        },
      });

      const orderPayload = {
        plan: priceSummary.plan,
        totalDays: priceSummary.plan.total_days,
        baseSubtotal: priceSummary.baseSubtotal,
        couponCode: priceSummary.couponCode,
        couponDiscount: priceSummary.couponDiscount,
        taxAmount: priceSummary.taxAmount,
        finalAmount: priceSummary.finalAmount,
        currency: priceSummary.currency,
        subscriptionId: rzSub.id,
        receipt: receiptId,
        isAutopay: true,
        isMock: Boolean(rzSub.isMock),
      };

      const insertRes = await query(
        `INSERT INTO orders (uid, payment_mode, amount, data, s_token, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uid,
          "RAZORPAY_AUTOPAY",
          priceSummary.finalAmount.toFixed(2),
          JSON.stringify(orderPayload),
          rzSub.id,
          "created",
        ]
      );

      return res.json({
        success: true,
        isAutopay: true,
        subscriptionId: rzSub.id,
        orderId: rzSub.id,
        order_id: rzSub.id,
        internalOrderId: insertRes.insertId,
        amount: priceSummary.amountMinor,
        currency: priceSummary.currency,
        keyId: config.keyId,
        pricing: priceSummary,
        isMock: Boolean(rzSub.isMock),
      });
    }

    // 2. STANDARD ONE-TIME ORDER FLOW
    const rzOrder = await createRazorpayOrder({
      amountMinor: priceSummary.amountMinor,
      currency: priceSummary.currency,
      receipt: receiptId,
      notes: {
        uid,
        planId: String(planId),
        couponCode: priceSummary.couponCode || "",
      },
    });

    const orderPayload = {
      plan: priceSummary.plan,
      totalDays: priceSummary.plan.total_days,
      baseSubtotal: priceSummary.baseSubtotal,
      couponCode: priceSummary.couponCode,
      couponDiscount: priceSummary.couponDiscount,
      taxAmount: priceSummary.taxAmount,
      finalAmount: priceSummary.finalAmount,
      currency: priceSummary.currency,
      razorpayOrderId: rzOrder.id,
      receipt: receiptId,
      isAutopay: false,
      isMock: Boolean(rzOrder.isMock),
    };

    const insertRes = await query(
      `INSERT INTO orders (uid, payment_mode, amount, data, s_token, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uid,
        "RAZORPAY",
        priceSummary.finalAmount.toFixed(2),
        JSON.stringify(orderPayload),
        rzOrder.id,
        "created",
      ]
    );

    res.json({
      success: true,
      isAutopay: false,
      orderId: rzOrder.id,
      order_id: rzOrder.id,
      internalOrderId: insertRes.insertId,
      amount: rzOrder.amount,
      currency: rzOrder.currency,
      keyId: config.keyId,
      pricing: priceSummary,
      isMock: Boolean(rzOrder.isMock),
    });
  } catch (err) {
    logger.error("[Billing] Order creation error:", err);
    res.status(500).json({ success: false, msg: err.message || "Failed to create order" });
  }
});

/**
 * POST /api/billing/verify_payment
 * Authoritative payment verification for both Autopay Subscriptions and Standard Orders.
 */
router.post("/verify_payment", validateUser, async (req, res) => {
  try {
    const referenceToken =
      req.body.razorpay_subscription_id ||
      req.body.razorpay_order_id ||
      req.body.subscriptionId ||
      req.body.orderId;
    const paymentId = req.body.razorpay_payment_id || req.body.paymentId;
    const signature = req.body.razorpay_signature || req.body.signature;
    const uid = req.decode.uid;

    if (!referenceToken || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        msg: "Missing required payment parameters",
      });
    }

    // 1. Tenant isolation check
    const [order] = await query(
      `SELECT * FROM orders WHERE s_token = ? AND uid = ? LIMIT 1`,
      [referenceToken, uid]
    );

    if (!order) {
      return res.status(403).json({
        success: false,
        msg: "Order not found or unauthorized access",
      });
    }

    // 2. Idempotency check
    if (order.status === "paid") {
      return res.json({
        success: true,
        alreadyProcessed: true,
        msg: "Payment already verified and plan activated.",
      });
    }

    // 3. Signature verification
    let isValidSignature = false;
    if (req.body.razorpay_subscription_id || req.body.subscriptionId) {
      isValidSignature = await verifySubscriptionSignature({
        subscriptionId: referenceToken,
        paymentId,
        signature,
      });
    } else {
      isValidSignature = await verifyRazorpaySignature({
        orderId: referenceToken,
        paymentId,
        signature,
      });
    }

    if (!isValidSignature) {
      await query(`UPDATE orders SET status = 'failed' WHERE id = ?`, [order.id]);
      return res.status(400).json({
        success: false,
        msg: "Invalid payment signature verification failed",
      });
    }

    // 4. Parse order data and load latest plan
    let orderData = {};
    try {
      orderData = JSON.parse(order.data);
    } catch (e) {
      logger.error("[Billing] Error parsing order data JSON:", e);
    }

    const planId = orderData.plan?.id;
    const [latestPlan] = await query(`SELECT * FROM plan WHERE id = ? LIMIT 1`, [planId]);
    const planToActivate = latestPlan || orderData.plan;

    if (!planToActivate) {
      return res.status(500).json({
        success: false,
        msg: "Could not resolve plan to activate",
      });
    }

    // 5. Activate plan
    const totalDays = orderData.totalDays || parseInt(planToActivate.plan_duration_in_days || 30, 10);
    const newExpiry = await updateUserPlan(planToActivate, uid, totalDays, true);

    // If Autopay subscription, attach subscription to user
    await query(
      `UPDATE user SET subscription_id = COALESCE(?, subscription_id), subscription_status = 'active', trial = 0 WHERE uid = ?`,
      [req.body.razorpay_subscription_id || req.body.subscriptionId || null, uid]
    );

    // 6. Coupon usage increment
    if (orderData.couponCode) {
      await query(
        `UPDATE coupon SET used_count = used_count + 1 WHERE UPPER(code) = ?`,
        [orderData.couponCode.toUpperCase()]
      );
    }

    // 7. Update internal order to 'paid'
    orderData.razorpayPaymentId = paymentId;
    orderData.razorpaySignature = signature;
    orderData.paidAt = new Date().toISOString();

    await query(
      `UPDATE orders SET status = 'paid', data = ? WHERE id = ?`,
      [JSON.stringify(orderData), order.id]
    );

    res.json({
      success: true,
      msg: "Payment verified successfully! Your plan is now active.",
      plan: planToActivate,
      newExpiry,
      isAutopay: Boolean(req.body.razorpay_subscription_id || req.body.subscriptionId),
    });
  } catch (err) {
    logger.error("[Billing] Payment verification error:", err);
    res.status(500).json({ success: false, msg: err.message || "Payment verification failed" });
  }
});

/**
 * POST /api/billing/cancel_autopay
 * Cancels active Autopay subscription for authenticated user.
 */
router.post("/cancel_autopay", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const [user] = await query(
      `SELECT subscription_id, subscription_status FROM user WHERE uid = ? LIMIT 1`,
      [uid]
    );

    if (!user || !user.subscription_id) {
      return res.status(400).json({
        success: false,
        msg: "No active autopay subscription found on this workspace",
      });
    }

    await cancelRazorpaySubscription(user.subscription_id);
    await query(`UPDATE user SET subscription_status = 'cancelled' WHERE uid = ?`, [uid]);

    res.json({
      success: true,
      msg: "Autopay cancelled successfully. Your plan will remain active until current expiration.",
    });
  } catch (err) {
    logger.error("[Billing] Cancel autopay error:", err);
    res.status(500).json({ success: false, msg: err.message || "Failed to cancel autopay" });
  }
});

/**
 * GET /api/billing/orders
 * Returns payment / order history for the authenticated user.
 */
router.get("/orders", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const orders = await query(
      `SELECT id, uid, payment_mode, amount, data, s_token, createdAt, status FROM orders WHERE uid = ? ORDER BY createdAt DESC LIMIT 50`,
      [uid]
    );

    const formattedOrders = orders.map((o) => {
      let parsedData = null;
      try {
        parsedData = JSON.parse(o.data);
      } catch (e) {
        parsedData = { raw: o.data };
      }

      return {
        id: o.id,
        paymentMode: o.payment_mode,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt,
        orderId: o.s_token,
        planTitle: parsedData?.plan?.title || "Plan",
        isAutopay: Boolean(parsedData?.isAutopay),
        couponCode: parsedData?.couponCode || null,
        couponDiscount: parsedData?.couponDiscount || 0,
        currency: parsedData?.currency || "USD",
        razorpayPaymentId: parsedData?.razorpayPaymentId || null,
      };
    });

    const [user] = await query(`SELECT subscription_id, subscription_status FROM user WHERE uid = ? LIMIT 1`, [uid]);

    res.json({
      success: true,
      orders: formattedOrders,
      autopay: {
        subscriptionId: user?.subscription_id || null,
        status: user?.subscription_status || null,
        isActive: user?.subscription_status === "active",
      },
    });
  } catch (err) {
    logger.error("[Billing] Orders history error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch orders" });
  }
});

/**
 * GET /api/billing/subscription
 * Retrieves the current authoritative subscription state, plan, and expiration for authenticated user.
 */
router.get("/subscription", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const [user] = await query(
      `SELECT uid, plan, plan_expire, trial, subscription_id, subscription_status FROM user WHERE uid = ? LIMIT 1`,
      [uid]
    );

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    let parsedPlan = null;
    if (user.plan) {
      try {
        parsedPlan = typeof user.plan === "string" ? JSON.parse(user.plan) : user.plan;
      } catch (e) {
        parsedPlan = null;
      }
    }

    const isExpired = user.plan_expire ? Number(user.plan_expire) < Date.now() : false;
    let status = user.subscription_status || (user.trial ? "trialing" : "inactive");
    if (isExpired && status !== "inactive") {
      status = "expired";
    }

    res.json({
      success: true,
      subscription: {
        status,
        plan: parsedPlan,
        expiresAt: user.plan_expire ? Number(user.plan_expire) : null,
        trial: Boolean(user.trial),
        subscriptionId: user.subscription_id || null,
        isExpired,
      },
    });
  } catch (err) {
    logger.error("[Billing] Get subscription error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch subscription" });
  }
});

/**
 * POST /api/billing/webhook
 * Razorpay webhook handler for server-to-server reconciliation (both orders and subscriptions).
 */
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = await verifyWebhookSignature({ rawBody, signature });
    if (!isValid) {
      logger.warn("[Billing Webhook] Invalid webhook signature rejected");
      return res.status(400).json({ success: false, msg: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.log(`[Billing Webhook] Received valid event: ${event}`);

    // Idempotency: verify this event has not been processed previously
    const eventId =
      req.headers["x-razorpay-event-id"] ||
      req.body?.event_id ||
      (payload?.payment?.entity?.id ? `${event}_${payload.payment.entity.id}` : null);

    if (eventId) {
      const [alreadyProcessed] = await query(
        `SELECT event_id FROM processed_webhook_events WHERE event_id = ? LIMIT 1`,
        [eventId],
      );
      if (alreadyProcessed) {
        logger.log(`[Billing Webhook] Duplicate event ${eventId} safely ignored (idempotent)`);
        return res.json({ status: "ok", success: true, duplicate: true });
      }
    }

    // Handle standard order payment captured
    if (event === "payment.captured" || event === "order.paid") {
      const entity = payload?.payment?.entity || payload?.order?.entity;
      const orderId = entity?.order_id || entity?.id;

      if (orderId) {
        const [order] = await query(`SELECT * FROM orders WHERE s_token = ? LIMIT 1`, [orderId]);
        if (order && order.status !== "paid") {
          let orderData = {};
          try {
            orderData = JSON.parse(order.data);
          } catch (e) {}

          const [plan] = await query(`SELECT * FROM plan WHERE id = ? LIMIT 1`, [orderData.plan?.id]);
          if (plan) {
            const totalDays = orderData.totalDays || parseInt(plan.plan_duration_in_days || 30, 10);
            await updateUserPlan(plan, order.uid, totalDays, true);

            orderData.paidAt = new Date().toISOString();
            orderData.webhookReconciled = true;

            await query(`UPDATE orders SET status = 'paid', data = ? WHERE id = ?`, [
              JSON.stringify(orderData),
              order.id,
            ]);
            await query(`UPDATE user SET subscription_status = 'active', trial = 0 WHERE uid = ?`, [order.uid]);
            logger.log(`[Billing Webhook] Order ${order.id} marked as paid via webhook reconciliation`);
          }
        }
      }
    }

    // Handle Autopay Subscription Charged (Automatic Renewal)
    if (event === "subscription.charged") {
      const entity = payload?.payment?.entity;
      const subEntity = payload?.subscription?.entity;
      const subId = entity?.subscription_id || subEntity?.id;

      if (subId) {
        const [user] = await query(`SELECT uid, plan FROM user WHERE subscription_id = ? LIMIT 1`, [subId]);
        if (user) {
          let userPlan = null;
          try {
            userPlan = JSON.parse(user.plan);
          } catch (e) {}
          if (userPlan) {
            const planDays = parseInt(userPlan.plan_duration_in_days || 30, 10);
            await updateUserPlan(userPlan, user.uid, planDays, true);

            // Insert new renewal order record
            await query(
              `INSERT INTO orders (uid, payment_mode, amount, data, s_token, status) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                user.uid,
                "RAZORPAY_AUTOPAY",
                ((entity?.amount || 0) / 100).toFixed(2),
                JSON.stringify({
                  plan: userPlan,
                  subscriptionId: subId,
                  paymentId: entity?.id,
                  autoRenewed: true,
                  isAutopay: true,
                }),
                subId,
                "paid",
              ]
            );
            logger.log(`[Billing Webhook] Autopay renewed for user ${user.uid} on subscription ${subId}`);
          }
        }
      }
    }

    // Handle Subscription Cancelled
    if (event === "subscription.cancelled") {
      const subId = payload?.subscription?.entity?.id;
      if (subId) {
        await query(`UPDATE user SET subscription_status = 'cancelled' WHERE subscription_id = ?`, [subId]);
      }
    }

    if (eventId) {
      await query(
        `INSERT IGNORE INTO processed_webhook_events (event_id, provider) VALUES (?, ?)`,
        [eventId, "razorpay"],
      );
    }

    res.json({ status: "ok", success: true });
  } catch (err) {
    logger.error("[Billing Webhook] Processing error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
