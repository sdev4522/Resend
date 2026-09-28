const crypto = require("crypto");
const axios = require("axios");
const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");

/**
 * Retrieves Razorpay configuration from database or environment variables.
 * Never exposes the key_secret to clients.
 */
async function getRazorpayConfig() {
  const [webPrivate] = await query(
    `SELECT rz_id, rz_key, rz_active, rz_webhook_secret FROM web_private LIMIT 1`
  );

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
      : "wacrm_rz_webhook_secret";

  const isActive = Boolean(
    (keyId && keySecret) || webPrivate?.rz_active == "1" || envKeyId
  );

  return {
    keyId: keyId || "rzp_test_mock_key_id",
    keySecret: keySecret || "rzp_test_mock_key_secret",
    webhookSecret,
    isConfigured: Boolean(keyId && keySecret && keyId !== "rzp_test_mock_key_id"),
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
    logger.log("[Razorpay] Using dev/mock order mode (credentials not configured in web_private or env)");
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
      logger.warn("[Razorpay] Authentication failed on api.razorpay.com. Using development test order.");
      return {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: amountMinor,
        currency: normalizedCurrency,
        status: "created",
        receipt: String(receipt),
        isMock: true,
      };
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
      logger.warn("[Razorpay] Authentication failed on api.razorpay.com. Using development test plan.");
      return {
        id: `plan_mock_${Date.now()}`,
        period,
        interval,
        item: { name, amount: amountMinor, currency: normalizedCurrency },
        isMock: true,
      };
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
      logger.warn("[Razorpay] Authentication failed on api.razorpay.com. Using development test subscription.");
      return {
        id: `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        plan_id: planId,
        status: "created",
        total_count: totalCount,
        customer_notify: customerNotify,
        notes,
        isMock: true,
      };
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

  if (!config.isConfigured || String(subscriptionId).startsWith("sub_mock_")) {
    return { id: subscriptionId, status: "cancelled", isMock: true };
  }

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
      return { id: subscriptionId, status: "cancelled", isMock: true };
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

  if (orderId.startsWith("order_mock_") && signature === "mock_signature_dev_test") {
    if (process.env.NODE_ENV === "production") {
      logger.error("[Razorpay Security] Mock signatures strictly forbidden in production!");
      return false;
    }
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", config.keySecret)
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

  if (subscriptionId.startsWith("sub_mock_") && signature === "mock_signature_dev_test") {
    if (process.env.NODE_ENV === "production") {
      logger.error("[Razorpay Security] Mock signatures strictly forbidden in production!");
      return false;
    }
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", config.keySecret)
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
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  verifyRazorpaySignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
};
