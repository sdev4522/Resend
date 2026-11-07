const express = require("express");
const router = express.Router();
const validateUser = require("../middlewares/user.js");
const { prisma } = require("../database/prisma");
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
const logger = require("../utils/logger");

const RAZORPAY_MIN_AMOUNT_MINOR = 100; // Razorpay rejects orders below 1.00 in the major unit

function parseJsonSafe(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

async function loadLivePlan(tx, planSnapshot) {
  const planId = parseInt(planSnapshot?.id, 10);
  if (!Number.isInteger(planId)) return planSnapshot || null;
  const row = await tx.plan.findFirst({ where: { id: planId } });
  if (!row) return planSnapshot || null;
  return { ...row, price: row.price != null ? Number(row.price) : 0 };
}

/**
 * Atomically claims an unpaid order and activates its plan, inside the given transaction.
 * The conditional UPDATE (status != 'paid') takes a row lock, so verify_payment and the
 * webhook (or two parallel verify calls) can never both credit the same order.
 *
 * @returns {Promise<{claimed: boolean, newExpiry?: number, plan?: object, previousSubscriptionId?: string|null}>}
 */
async function activatePaidOrder(tx, order, { paymentId, signature = null, subscriptionId = null, source }) {
  const orderData = parseJsonSafe(order.data);
  orderData.razorpayPaymentId = paymentId || orderData.razorpayPaymentId || null;
  if (signature) orderData.razorpaySignature = signature;
  orderData.paidAt = new Date().toISOString();
  orderData.paidVia = source;

  const claim = await tx.orders.updateMany({
    where: {
      id: order.id,
      OR: [{ status: null }, { status: { notIn: ["paid", "refunded"] } }],
    },
    data: { status: "paid", data: JSON.stringify(orderData) },
  });
  if (claim.count !== 1) {
    return { claimed: false };
  }

  const planToActivate = await loadLivePlan(tx, orderData.plan);
  if (!planToActivate) {
    throw new Error("Could not resolve plan to activate");
  }

  const totalDays =
    orderData.totalDays || parseInt(planToActivate.plan_duration_in_days || 30, 10);

  const before = await tx.user.findFirst({
    where: { uid: order.uid },
    select: { subscription_id: true },
  });

  const newExpiry = await updateUserPlan(planToActivate, order.uid, totalDays, true, tx);

  await tx.user.updateMany({
    where: { uid: order.uid },
    data: {
      subscription_id: subscriptionId || undefined,
      subscription_status: "active",
      trial: 0,
    },
  });

  if (orderData.couponCode) {
    await tx.coupon.updateMany({
      where: { code: String(orderData.couponCode).toUpperCase() },
      data: { used_count: { increment: 1 } },
    });
  }

  const previousSubscriptionId =
    subscriptionId && before?.subscription_id && before.subscription_id !== subscriptionId
      ? before.subscription_id
      : null;

  return { claimed: true, newExpiry, plan: planToActivate, previousSubscriptionId };
}

/** A new autopay replaced an older one: stop the old subscription so it is not charged too. */
async function cancelReplacedSubscription(previousSubscriptionId) {
  if (!previousSubscriptionId) return;
  try {
    await cancelRazorpaySubscription(previousSubscriptionId);
    logger.log(`[Billing] Cancelled replaced subscription ${previousSubscriptionId}`);
  } catch (err) {
    logger.error(
      `[Billing] Failed to cancel replaced subscription ${previousSubscriptionId} — cancel it manually:`,
      err.message,
    );
  }
}

function isUniqueViolation(err) {
  return err?.code === "P2002";
}

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
    const rawPlans = await prisma.plan.findMany({
      orderBy: [
        { is_trial: "desc" },
        { price: "asc" },
      ],
    });

    const plans = rawPlans.map((p) => ({
      ...p,
      price: p.price != null ? Number(p.price) : 0,
    }));

    const allPrices = await prisma.plan_prices.findMany({
      where: { is_active: true },
    });

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

    const user = await prisma.user.findFirst({
      where: { uid },
    });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const now = Date.now();
    const planExpire = Number(user.plan_expire || 0);
    const planActive = planExpire > now;
    const currentPlan = parseJsonSafe(user.plan, null);

    // Already trialing (signup assigns the trial): treat as success so onboarding can finish.
    if (planActive && Number(user.trial) === 1) {
      return res.json({
        success: true,
        alreadyActive: true,
        msg: "Your free trial is already active.",
        plan: currentPlan,
        subscription_status: "trialing",
        newExpiry: planExpire,
      });
    }

    // Any unexpired paid plan (active OR cancelled autopay) must not be overwritten by a trial
    if (planActive && !Number(user.trial)) {
      return res.status(400).json({
        success: false,
        msg: "You already have an active paid subscription.",
      });
    }

    // Trial is one-time: FREE_TRIAL order is the permanent marker (see updateUserPlan)
    const trialOrder = await prisma.orders.findFirst({
      where: { uid, payment_mode: "FREE_TRIAL" },
      select: { id: true },
    });
    if (trialOrder) {
      return res.status(400).json({
        success: false,
        msg: "You have already used your free trial.",
      });
    }

    const rawTrialPlan = await prisma.plan.findFirst({
      where: { is_trial: 1 },
      orderBy: { id: "asc" },
    });

    if (!rawTrialPlan) {
      return res.status(500).json({
        success: false,
        msg: "No trial plan configured in system",
      });
    }

    const trialPlan = {
      ...rawTrialPlan,
      price: rawTrialPlan.price != null ? Number(rawTrialPlan.price) : 0,
    };

    const trialDays = parseInt(trialPlan.plan_duration_in_days || 14, 10);

    // updateUserPlan also writes the FREE_TRIAL order inside the same transaction
    const newExpiry = await prisma.$transaction(async (tx) => {
      const recheck = await tx.orders.findFirst({
        where: { uid, payment_mode: "FREE_TRIAL" },
        select: { id: true },
      });
      if (recheck) {
        const err = new Error("You have already used your free trial.");
        err.status = 400;
        throw err;
      }
      return updateUserPlan(trialPlan, uid, trialDays, false, tx);
    });

    res.json({
      success: true,
      msg: `${trialDays}-day free trial activated successfully!`,
      plan: trialPlan,
      subscription_status: "trialing",
      newExpiry,
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, msg: err.message });
    }
    logger.error("[Billing] Activate trial error:", err);
    res.status(500).json({ success: false, msg: "Failed to activate trial" });
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

    // A coupon on autopay would be baked into the recurring Razorpay plan and discount
    // every renewal, so coupons are limited to one-time payments.
    if (autopay && couponCode && String(couponCode).trim() !== "") {
      return res.status(400).json({
        success: false,
        msg: "Coupons can only be applied to one-time payments, not autopay.",
      });
    }

    // Authoritative calculation
    const priceSummary = await calculateCheckoutPrice({
      planId,
      durationMonths: 1,
      couponCode: couponCode || null,
      targetCurrency: currency || null,
    });

    if (priceSummary.amountMinor < RAZORPAY_MIN_AMOUNT_MINOR) {
      return res.status(400).json({
        success: false,
        msg: "The payable amount is too low for online payment. Please use a different coupon or contact support.",
      });
    }

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

      const newOrder = await prisma.orders.create({
        data: {
          uid,
          payment_mode: "RAZORPAY_AUTOPAY",
          amount: priceSummary.finalAmount.toFixed(2),
          data: JSON.stringify(orderPayload),
          s_token: rzSub.id,
          status: "created",
        },
      });

      return res.json({
        success: true,
        isAutopay: true,
        subscriptionId: rzSub.id,
        orderId: rzSub.id,
        order_id: rzSub.id,
        internalOrderId: newOrder.id,
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

    const newOrder = await prisma.orders.create({
      data: {
        uid,
        payment_mode: "RAZORPAY",
        amount: priceSummary.finalAmount.toFixed(2),
        data: JSON.stringify(orderPayload),
        s_token: rzOrder.id,
        status: "created",
      },
    });

    res.json({
      success: true,
      isAutopay: false,
      orderId: rzOrder.id,
      order_id: rzOrder.id,
      internalOrderId: newOrder.id,
      amount: rzOrder.amount,
      currency: rzOrder.currency,
      keyId: config.keyId,
      pricing: priceSummary,
      isMock: Boolean(rzOrder.isMock),
    });
  } catch (err) {
    logger.error("[Billing] Order creation error:", err);
    if (err.code === "PAYMENT_GATEWAY_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, code: err.code, msg: err.message });
    }
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
    const order = await prisma.orders.findFirst({
      where: {
        s_token: referenceToken,
        uid,
      },
    });

    if (!order) {
      return res.status(403).json({
        success: false,
        msg: "Order not found or unauthorized access",
      });
    }

    // 2. Idempotency check
    if (order.status === "refunded") {
      return res.status(400).json({ success: false, msg: "This order was refunded." });
    }
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
      await prisma.orders.updateMany({
        where: { id: order.id, OR: [{ status: null }, { status: { notIn: ["paid", "refunded"] } }] },
        data: { status: "failed" },
      });
      return res.status(400).json({
        success: false,
        msg: "Invalid payment signature verification failed",
      });
    }

    // 4. Atomically claim the order and activate its plan (idempotent vs webhook / retries)
    const subIdToAttach = req.body.razorpay_subscription_id || req.body.subscriptionId || null;
    const result = await prisma.$transaction((tx) =>
      activatePaidOrder(tx, order, {
        paymentId,
        signature,
        subscriptionId: subIdToAttach,
        source: "verify_payment",
      }),
    );

    if (!result.claimed) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        msg: "Payment already verified and plan activated.",
      });
    }

    await cancelReplacedSubscription(result.previousSubscriptionId);

    res.json({
      success: true,
      msg: "Payment verified successfully! Your plan is now active.",
      plan: result.plan,
      newExpiry: result.newExpiry,
      isAutopay: Boolean(subIdToAttach),
    });
  } catch (err) {
    logger.error("[Billing] Payment verification error:", err);
    res.status(500).json({ success: false, msg: "Payment verification failed" });
  }
});

/**
 * POST /api/billing/cancel_autopay
 * Cancels active Autopay subscription for authenticated user.
 */
router.post("/cancel_autopay", validateUser, async (req, res) => {
  try {
    const uid = req.decode.uid;
    const user = await prisma.user.findFirst({
      where: { uid },
      select: { subscription_id: true, subscription_status: true },
    });

    if (!user || !user.subscription_id) {
      return res.status(400).json({
        success: false,
        msg: "No active autopay subscription found on this workspace",
      });
    }

    await cancelRazorpaySubscription(user.subscription_id);
    await prisma.user.updateMany({
      where: { uid },
      data: { subscription_status: "cancelled" },
    });

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
    const orders = await prisma.orders.findMany({
      where: { uid },
      select: {
        id: true,
        uid: true,
        payment_mode: true,
        amount: true,
        data: true,
        s_token: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

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

    const user = await prisma.user.findFirst({
      where: { uid },
      select: { subscription_id: true, subscription_status: true },
    });

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
    const user = await prisma.user.findFirst({
      where: { uid },
      select: {
        uid: true,
        plan: true,
        plan_expire: true,
        trial: true,
        subscription_id: true,
        subscription_status: true,
      },
    });

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
    // Signature MUST be computed over the exact raw bytes; never over re-serialised JSON
    const rawBody = req.rawBody;

    const isValid = await verifyWebhookSignature({ rawBody, signature });
    if (!isValid) {
      logger.warn("[Billing Webhook] Invalid webhook signature rejected");
      return res.status(400).json({ success: false, msg: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    logger.log(`[Billing Webhook] Received valid event: ${event}`);

    const paymentEntity = payload?.payment?.entity;
    const eventId =
      req.headers["x-razorpay-event-id"] ||
      req.body?.event_id ||
      (paymentEntity?.id ? `${event}_${paymentEntity.id}` : null);

    let replacedSubscriptionId = null;

    try {
      await prisma.$transaction(async (tx) => {
        // Idempotency marker is written in the SAME transaction as the side effects:
        // a duplicate delivery hits the primary key, a failed run rolls the marker back.
        if (eventId) {
          await tx.processed_webhook_events.create({
            data: { event_id: String(eventId), provider: "razorpay" },
          });
        }

        // One-time order paid
        if (event === "payment.captured" || event === "order.paid") {
          const entity = paymentEntity || payload?.order?.entity;
          const orderId = entity?.order_id || payload?.order?.entity?.id;
          if (!orderId) return;

          const order = await tx.orders.findFirst({ where: { s_token: String(orderId) } });
          if (!order) return;

          const result = await activatePaidOrder(tx, order, {
            paymentId: paymentEntity?.id || null,
            source: "webhook",
          });
          if (result.claimed) {
            logger.log(`[Billing Webhook] Order ${order.id} marked as paid via webhook reconciliation`);
          }
          return;
        }

        // Autopay charge: first invoice activates the initial order, later ones renew
        if (event === "subscription.charged") {
          const subId = paymentEntity?.subscription_id || payload?.subscription?.entity?.id;
          const chargePaymentId = paymentEntity?.id || null;
          if (!subId) return;

          const initialOrder = await tx.orders.findFirst({
            where: { s_token: String(subId), payment_mode: "RAZORPAY_AUTOPAY" },
            orderBy: { id: "asc" },
          });
          if (!initialOrder) {
            logger.warn(`[Billing Webhook] No order found for subscription ${subId}`);
            return;
          }

          if (initialOrder.status !== "paid") {
            const result = await activatePaidOrder(tx, initialOrder, {
              paymentId: chargePaymentId,
              subscriptionId: String(subId),
              source: "webhook",
            });
            if (result.claimed) {
              replacedSubscriptionId = result.previousSubscriptionId;
              return;
            }
          }

          // Already credited this exact payment (e.g. by verify_payment)?
          if (chargePaymentId) {
            const credited = await tx.orders.findFirst({
              where: {
                s_token: String(subId),
                status: "paid",
                data: { contains: String(chargePaymentId) },
              },
              select: { id: true },
            });
            if (credited) return;
          }

          // Renewal: extend the plan that was SUBSCRIBED to, for the subscribing user
          const initialData = parseJsonSafe(initialOrder.data);
          const plan = await loadLivePlan(tx, initialData.plan);
          if (!plan) {
            logger.error(`[Billing Webhook] Could not resolve plan for subscription ${subId}`);
            return;
          }
          const planDays = parseInt(plan.plan_duration_in_days || 30, 10);

          await updateUserPlan(plan, initialOrder.uid, planDays, true, tx);
          await tx.user.updateMany({
            where: { uid: initialOrder.uid },
            data: { subscription_status: "active", trial: 0 },
          });
          await tx.orders.create({
            data: {
              uid: initialOrder.uid,
              payment_mode: "RAZORPAY_AUTOPAY",
              amount: ((paymentEntity?.amount || 0) / 100).toFixed(2),
              data: JSON.stringify({
                plan,
                subscriptionId: subId,
                paymentId: chargePaymentId,
                razorpayPaymentId: chargePaymentId,
                autoRenewed: true,
                isAutopay: true,
              }),
              s_token: String(subId),
              status: "paid",
            },
          });
          logger.log(`[Billing Webhook] Autopay renewed for user ${initialOrder.uid} on subscription ${subId}`);
          return;
        }

        if (
          event === "subscription.cancelled" ||
          event === "subscription.halted" ||
          event === "subscription.completed"
        ) {
          const subId = payload?.subscription?.entity?.id;
          if (subId) {
            await tx.user.updateMany({
              where: { subscription_id: String(subId) },
              data: {
                subscription_status: event === "subscription.halted" ? "halted" : "cancelled",
              },
            });
          }
          return;
        }

        // Refund: record it on the order and flag for manual review. Access is not revoked
        // automatically (partial refunds / goodwill refunds are common).
        if (event === "refund.processed" || event === "payment.refunded") {
          const orderId = paymentEntity?.order_id;
          if (!orderId) return;
          const order = await tx.orders.findFirst({ where: { s_token: String(orderId) } });
          if (!order) return;
          const orderData = parseJsonSafe(order.data);
          orderData.refundedAt = new Date().toISOString();
          orderData.refundEvent = event;
          await tx.orders.update({
            where: { id: order.id },
            data: { status: "refunded", data: JSON.stringify(orderData) },
          });
          logger.warn(`[Billing Webhook] Order ${order.id} refunded — review plan access for ${order.uid}`);
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        logger.log(`[Billing Webhook] Duplicate event ${eventId} safely ignored (idempotent)`);
        return res.json({ status: "ok", success: true, duplicate: true });
      }
      throw err;
    }

    await cancelReplacedSubscription(replacedSubscriptionId);

    res.json({ status: "ok", success: true });
  } catch (err) {
    logger.error("[Billing Webhook] Processing error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
