const crypto = require("crypto");
const axios = require("axios");
const { prisma } = require("../database/prisma");
const logger = require("../utils/logger");

// Dev-only mock secret (the onboarding modal's dev simulator signs with it).
// It is ONLY accepted when mock mode is explicitly enabled — never as a fallback.
const DEV_MOCK_KEY_SECRET = "rzp_test_mock_key_secret";

/**
 * Mock checkout is allowed only when RAZORPAY_MOCK=1 AND NODE_ENV is not production.
 * Missing credentials alone must never enable mock payments.
 */
function isMockModeAllowed() {
  return process.env.RAZORPAY_MOCK === "1" && process.env.NODE_ENV !== "production";
}

function notConfiguredError() {
  const err = new Error("Payment gateway is not configured. Please contact support.");
  err.code = "PAYMENT_GATEWAY_NOT_CONFIGURED";
  return err;
}

/**
 * Retrieves Razorpay configuration from database or environment variables.
 * Never exposes the key_secret to clients.
 */
async function getRazorpayConfig() {
  const webPrivate = await prisma.web_private.findFirst({
    select: {
      rz_id: true,
      rz_key: true,
      rz_active: true,
      rz_webhook_secret: true,
    },
  });

  const envKeyId = process.env.RAZORPAY_KEY_ID;
  const envKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const envWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const keyId =
    envKeyId && envKeyId.trim() !== ""
      ? envKeyId.trim()
      : webPrivate?.rz_id && webPrivate.rz_id !== "xxxxxxxxxxxxxxxxx"
      ? webPrivate.rz_id.trim()
      : null;

  const keySecret =
    envKeySecret && envKeySecret.trim() !== ""
      ? envKeySecret.trim()
      : webPrivate?.rz_key && webPrivate.rz_key !== "xxxxxxxxxxxxxxxxx"
      ? webPrivate.rz_key.trim()
      : null;

  const webhookSecret =
    envWebhookSecret && envWebhookSecret.trim() !== ""
      ? envWebhookSecret.trim()
      : webPrivate?.rz_webhook_secret && webPrivate.rz_webhook_secret.trim() !== ""
      ? webPrivate.rz_webhook_secret.trim()
      : null;

  const isActive = Boolean(
    (keyId && keySecret) || webPrivate?.rz_active == "1" || envKeyId
  );

  const isConfigured = Boolean(keyId && keySecret);

  return {
    keyId: keyId || (isMockModeAllowed() ? "rzp_test_mock_key_id" : null),
    keySecret,
    webhookSecret,
    isConfigured,
    isMockMode: !isConfigured && isMockModeAllowed(),
    isActive,
  };
}

/**
 * Creates a Razorpay Order via REST API.
 */
async function createRazorpayOrder({ amountMinor, currency = "USD", receipt, notes = {} }) {
  const config = await getRazorpayConfig();
  const normalizedCurrency = currency.toUpperCase();

  if (!config.isConfigured) {
    if (!config.isMockMode) throw notConfiguredError();
    logger.log("[Razorpay] Using dev/mock order mode (RAZORPAY_MOCK=1, non-production)");
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: mockOrderId,
      amount: amountMinor,
      currency: normalizedCurrency,
      status: "created",
      receipt: String(receipt),
      isMock: true,
    };
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: Math.round(amountMinor),
        currency: normalizedCurrency,
        receipt: String(receipt).slice(0, 40),
        notes: notes || {},
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error("[Razorpay] Authentication failed on api.razorpay.com — check key id / secret.");
      throw notConfiguredError();
    }
    logger.error("[Razorpay] Order creation failed:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.description || "Failed to create Razorpay order"
    );
  }
}

/**
 * Creates a Razorpay Recurring Plan for Autopay.
 */
async function createRazorpayPlan({ name, amountMinor, currency = "INR", period = "monthly", interval = 1 }) {
  const config = await getRazorpayConfig();
  const normalizedCurrency = currency.toUpperCase();

  if (!config.isConfigured) {
    if (!config.isMockMode) throw notConfiguredError();
    return {
      id: `plan_mock_${Date.now()}`,
      period,
      interval,
      item: { name, amount: amountMinor, currency: normalizedCurrency },
      isMock: true,
    };
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/plans",
      {
        period: period,
        interval: interval,
        item: {
          name: name.slice(0, 40),
          amount: Math.round(amountMinor),
          currency: normalizedCurrency,
          description: `${name} recurring plan`,
        },
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error("[Razorpay] Authentication failed on api.razorpay.com — check key id / secret.");
      throw notConfiguredError();
    }
    logger.error("[Razorpay] Plan creation failed:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.description || "Failed to create Razorpay recurring plan"
    );
  }
}

/**
 * Creates a Razorpay Subscription for Autopay.
 */
async function createRazorpaySubscription({ planId, customerNotify = 1, totalCount = 60, notes = {} }) {
  const config = await getRazorpayConfig();

  if (!config.isConfigured || String(planId).startsWith("plan_mock_")) {
    if (!config.isMockMode) throw notConfiguredError();
    const mockSubId = `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: mockSubId,
      plan_id: planId,
      status: "created",
      total_count: totalCount,
      customer_notify: customerNotify,
      notes,
      isMock: true,
    };
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/subscriptions",
      {
        plan_id: planId,
        total_count: totalCount,
        customer_notify: customerNotify,
        notes: notes || {},
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error("[Razorpay] Authentication failed on api.razorpay.com — check key id / secret.");
      throw notConfiguredError();
    }
    logger.error("[Razorpay] Subscription creation failed:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.description || "Failed to create Razorpay subscription"
    );
  }
}

/**
 * Cancels a Razorpay Subscription.
 */
async function cancelRazorpaySubscription(subscriptionId) {
  const config = await getRazorpayConfig();

  if (String(subscriptionId).startsWith("sub_mock_")) {
    // A mock subscription never existed on Razorpay; nothing to cancel remotely.
    return { id: subscriptionId, status: "cancelled", isMock: true };
  }
  if (!config.isConfigured) throw notConfiguredError();

  const authHeader =
    "Basic " +
    Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

  try {
    const response = await axios.post(
      `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
      { cancel_at_cycle_end: 0 },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error("[Razorpay] Authentication failed on api.razorpay.com — subscription NOT cancelled.");
      throw notConfiguredError();
    }
    logger.error("[Razorpay] Subscription cancellation failed:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.description || "Failed to cancel subscription"
    );
  }
}

/**
 * Server-side HMAC-SHA256 signature verification for one-time orders.
 */
async function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const config = await getRazorpayConfig();

  const isMockId = String(orderId).startsWith("order_mock_");
  let secret = config.keySecret;

  if (isMockId) {
    // Mock ids are only valid in explicit dev mock mode
    if (!config.isMockMode) {
      logger.error("[Razorpay Security] Mock payment rejected (mock mode disabled).");
      return false;
    }
    if (signature === "mock_signature_dev_test") return true;
    secret = DEV_MOCK_KEY_SECRET;
  }

  if (!secret) {
    logger.error("[Razorpay Security] Key secret not configured; signature cannot be verified.");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch (err) {
    logger.error("[Razorpay] Signature verification error:", err);
    return false;
  }
}

/**
 * Server-side HMAC-SHA256 signature verification for Subscriptions / Autopay.
 */
async function verifySubscriptionSignature({ subscriptionId, paymentId, signature }) {
  if (!subscriptionId || !paymentId || !signature) {
    return false;
  }

  const config = await getRazorpayConfig();

  const isMockId = String(subscriptionId).startsWith("sub_mock_");
  let secret = config.keySecret;

  if (isMockId) {
    // Mock ids are only valid in explicit dev mock mode
    if (!config.isMockMode) {
      logger.error("[Razorpay Security] Mock payment rejected (mock mode disabled).");
      return false;
    }
    if (signature === "mock_signature_dev_test") return true;
    secret = DEV_MOCK_KEY_SECRET;
  }

  if (!secret) {
    logger.error("[Razorpay Security] Key secret not configured; signature cannot be verified.");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch (err) {
    logger.error("[Razorpay] Subscription signature verification error:", err);
    return false;
  }
}

/**
 * Server-side HMAC-SHA256 webhook signature verification.
 */
async function verifyWebhookSignature({ rawBody, signature }) {
  if (!rawBody || !signature) {
    return false;
  }

  const config = await getRazorpayConfig();
  const secret = config.webhookSecret;
  if (!secret) {
    logger.error("[Razorpay Security] Webhook secret not configured in web_private");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch (err) {
    logger.error("[Razorpay] Webhook signature verification error:", err);
    return false;
  }
}

module.exports = {
  getRazorpayConfig,
  isMockModeAllowed,
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  verifyRazorpaySignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
};
