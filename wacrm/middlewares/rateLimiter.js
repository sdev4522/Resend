const { query } = require("../database/dbpromise");
const logger = require("../utils/logger");

const RATE_LIMIT_ENABLED = process.env.API_RATE_LIMIT_ENABLED !== "false";

// Default Rate Limit Policies (configurable via environment)
const DEFAULT_LIMITS = {
  IP_REQ_PER_MIN: parseInt(process.env.RATE_LIMIT_IP_PER_MIN || "120", 10),
  KEY_REQ_PER_MIN: parseInt(process.env.RATE_LIMIT_KEY_PER_MIN || "60", 10),
  WORKSPACE_REQ_PER_MIN: parseInt(process.env.RATE_LIMIT_WS_PER_MIN || "120", 10),
  CONNECTION_MSG_PER_MIN: parseInt(process.env.RATE_LIMIT_CONN_PER_MIN || "30", 10),
};

/**
 * Check and increment an atomic sliding-window counter in the database
 */
async function checkBucket(bucketKey, limit, windowSizeMs = 60000) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowSizeMs) * windowSizeMs;

  try {
    // Atomic Upsert
    await query(
      `INSERT INTO api_rate_limits (bucket_key, window_start, request_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         request_count = IF(window_start = VALUES(window_start), request_count + 1, 1),
         window_start = VALUES(window_start)`,
      [bucketKey, windowStart]
    );

    const rows = await query(
      `SELECT request_count, window_start FROM api_rate_limits WHERE bucket_key = ? LIMIT 1`,
      [bucketKey]
    );

    const currentCount = rows[0]?.request_count || 1;
    const windowStartMs = Number(rows[0]?.window_start || windowStart);
    const resetTimeSec = Math.ceil((windowStartMs + windowSizeMs) / 1000);
    const retryAfterSec = Math.max(1, Math.ceil((windowStartMs + windowSizeMs - now) / 1000));
    const remaining = Math.max(0, limit - currentCount);

    return {
      exceeded: currentCount > limit,
      limit,
      currentCount,
      remaining,
      resetTimeSec,
      retryAfterSec,
    };
  } catch (err) {
    logger.error("Rate limiter DB error:", err.message);
    // On DB glitch, fail open to avoid service outage
    return {
      exceeded: false,
      limit,
      currentCount: 1,
      remaining: limit - 1,
      resetTimeSec: Math.ceil((now + windowSizeMs) / 1000),
      retryAfterSec: 60,
    };
  }
}

/**
 * IP-level Rate Limiter (Layer 1 - Flood & Brute-force protection)
 */
function ipRateLimiter() {
  return async (req, res, next) => {
    if (!RATE_LIMIT_ENABLED) return next();

    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      "unknown_ip";

    const bucketKey = `ip:${clientIp}`;
    const result = await checkBucket(bucketKey, DEFAULT_LIMITS.IP_REQ_PER_MIN);

    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", result.resetTimeSec);

    if (result.exceeded) {
      res.setHeader("Retry-After", result.retryAfterSec);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `IP request rate limit exceeded (${result.limit}/min). Please retry after ${result.retryAfterSec}s.`,
          request_id: req.requestId,
        },
      });
    }

    next();
  };
}

/**
 * Multi-layer Rate Limiter for Authenticated Requests
 * Checks: Layer 2 (API Key) & Layer 3 (Workspace)
 */
function apiRateLimiter() {
  return async (req, res, next) => {
    if (!RATE_LIMIT_ENABLED) return next();

    const apiKey = req.apiKey;
    const workspaceId = req.workspaceId;

    if (!apiKey || !workspaceId) return next();

    // 1. Layer 2: API Key Rate Limit
    let keyLimit = DEFAULT_LIMITS.KEY_REQ_PER_MIN;
    if (apiKey.rate_limit_policy) {
      try {
        const policy = typeof apiKey.rate_limit_policy === "string" 
          ? JSON.parse(apiKey.rate_limit_policy) 
          : apiKey.rate_limit_policy;
        if (policy.requests_per_minute) {
          keyLimit = parseInt(policy.requests_per_minute, 10);
        }
      } catch {}
    }

    const keyResult = await checkBucket(`key:${apiKey.id}`, keyLimit);

    res.setHeader("X-RateLimit-Limit", keyResult.limit);
    res.setHeader("X-RateLimit-Remaining", keyResult.remaining);
    res.setHeader("X-RateLimit-Reset", keyResult.resetTimeSec);

    if (keyResult.exceeded) {
      res.setHeader("Retry-After", keyResult.retryAfterSec);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `API key rate limit exceeded (${keyResult.limit}/min). Please slow down.`,
          request_id: req.requestId,
        },
      });
    }

    // 2. Layer 3: Workspace Level Rate Limit
    const wsResult = await checkBucket(`ws:${workspaceId}`, DEFAULT_LIMITS.WORKSPACE_REQ_PER_MIN);
    if (wsResult.exceeded) {
      res.setHeader("Retry-After", wsResult.retryAfterSec);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Workspace rate limit exceeded across all API keys (${wsResult.limit}/min).`,
          request_id: req.requestId,
        },
      });
    }

    next();
  };
}

/**
 * Connection-level Throughput Rate Limiter (Layer 4 - prevent WhatsApp account ban)
 */
async function checkConnectionRateLimit(connectionPublicId) {
  if (!RATE_LIMIT_ENABLED || !connectionPublicId) return { allowed: true };

  const result = await checkBucket(
    `conn:${connectionPublicId}`,
    DEFAULT_LIMITS.CONNECTION_MSG_PER_MIN
  );

  return {
    allowed: !result.exceeded,
    retryAfter: result.retryAfterSec,
    limit: result.limit,
  };
}

/**
 * Plan Monthly Quota Checker (Layer 5)
 */
async function checkPlanMonthlyQuota(uid, plan) {
  if (!uid || !plan) return { allowed: true };

  // Check if plan has custom or contact limit
  const quotaLimit = parseInt(plan.custom?.message_quota || plan.contact_limit || "100000", 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [row] = await query(
    `SELECT COUNT(*) as current_count FROM api_usage_events 
     WHERE uid = ? AND message_id IS NOT NULL AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
    [uid, currentMonth]
  );

  const used = row?.current_count || 0;
  return {
    allowed: used < quotaLimit,
    used,
    limit: quotaLimit,
  };
}

/**
 * Dedicated Rate Limiter for Authentication, Password Reset, and Sensitive Operations
 */
function authRateLimiter({ limit = 10, windowSizeMs = 60000, prefix = "auth" } = {}) {
  return async (req, res, next) => {
    if (!RATE_LIMIT_ENABLED) return next();

    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      "unknown_ip";

    const bucketKey = `${prefix}:${clientIp}`;
    const result = await checkBucket(bucketKey, limit, windowSizeMs);

    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", result.resetTimeSec);

    if (result.exceeded) {
      res.setHeader("Retry-After", result.retryAfterSec);
      return res.status(429).json({
        success: false,
        error: "Too many attempts. Please try again later.",
        retryAfter: result.retryAfterSec,
      });
    }

    next();
  };
}

module.exports = {
  ipRateLimiter,
  apiRateLimiter,
  authRateLimiter,
  checkConnectionRateLimit,
  checkPlanMonthlyQuota,
  DEFAULT_LIMITS,
};
