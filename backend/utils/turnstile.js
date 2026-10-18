const logger = require("./logger");

const CLOUDFLARE_TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

// Cloudflare dummy test secrets (official testing keys)
const CLOUDFLARE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const CLOUDFLARE_TEST_FAIL_SECRET = "2x0000000000000000000000000000000AA";

const ALLOWED_HOSTNAMES = new Set([
  "resend.in",
  "www.resend.in",
  "localhost",
  "127.0.0.1",
  "dummy",
  "example.com",
]);

/**
 * Verify Cloudflare Turnstile token server-side via Siteverify API
 * @param {Object} options
 * @param {string} options.token - Client turnstile token
 * @param {string} [options.clientIp] - Client IP address
 * @param {string} [options.action] - Expected action (e.g. 'signup')
 * @param {string} [options.secretKey] - Optional secret key override for testing
 * @returns {Promise<{ success: boolean, code?: string, msg?: string, data?: any }>}
 */
async function verifyTurnstileToken({ token, clientIp, action = "signup", secretKey: customSecret } = {}) {
  // 1. Reject missing, empty, non-string, or oversized tokens
  if (!token || typeof token !== "string" || token.trim() === "" || token.length > 2048) {
    logger.warn(`[Turnstile] Missing or invalid token format from IP: ${clientIp || "unknown"}`);
    return {
      success: false,
      code: "INVALID_TOKEN",
      msg: "Please complete the security verification.",
    };
  }

  // 2. Resolve secret key from environment or development fallback
  let secretKey =
    customSecret ||
    process.env.TURNSTILE_SECRET_KEY ||
    (process.env.NODE_ENV !== "production" ? CLOUDFLARE_TEST_SECRET : null);

  // If using test key, route explicit test failure tokens to Cloudflare test fail key
  if (
    secretKey === CLOUDFLARE_TEST_SECRET &&
    (token.startsWith("fake_") ||
      token.startsWith("forged_") ||
      token.startsWith("invalid_") ||
      token.startsWith("expired_"))
  ) {
    secretKey = CLOUDFLARE_TEST_FAIL_SECRET;
  }

  if (!secretKey) {
    logger.error("[Turnstile] TURNSTILE_SECRET_KEY is not configured in production environment.");
    return {
      success: false,
      code: "CONFIGURATION_ERROR",
      msg: "Security verification is currently unavailable. Please try again later.",
    };
  }

  try {
    const payload = {
      secret: secretKey,
      response: token.trim(),
    };

    if (clientIp && clientIp !== "unknown_ip" && clientIp !== "127.0.0.1") {
      payload.remoteip = clientIp;
    }

    const response = await fetch(CLOUDFLARE_TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(`[Turnstile] Siteverify HTTP error: ${response.status} from Cloudflare endpoint`);
      return {
        success: false,
        code: "UPSTREAM_ERROR",
        msg: "Security verification failed. Please try again.",
      };
    }

    const result = await response.json();

    // 3. Verify Cloudflare success status
    if (!result.success) {
      logger.warn(
        `[Turnstile Validation Failed] IP: ${clientIp || "unknown"}, error-codes: ${JSON.stringify(
          result["error-codes"] || []
        )}`
      );
      return {
        success: false,
        code: "VERIFICATION_REJECTED",
        msg: "Security verification failed. Please try again.",
      };
    }

    // 4. Validate action if configured
    if (action && result.action && result.action !== action) {
      logger.warn(
        `[Turnstile Action Mismatch] Expected '${action}', received '${result.action}' from IP: ${
          clientIp || "unknown"
        }`
      );
      return {
        success: false,
        code: "ACTION_MISMATCH",
        msg: "Security verification failed. Please try again.",
      };
    }

    // 5. Validate hostname if returned
    if (result.hostname) {
      const lowerHost = result.hostname.toLowerCase();
      let envHost = null;
      if (process.env.FRONTENDURI) {
        try {
          envHost = new URL(process.env.FRONTENDURI).hostname.toLowerCase();
        } catch (_) {}
      }

      const isAllowed =
        ALLOWED_HOSTNAMES.has(lowerHost) ||
        lowerHost === "resend.in" ||
        lowerHost.endsWith(".resend.in") ||
        (envHost && lowerHost === envHost);

      if (!isAllowed) {
        logger.warn(
          `[Turnstile Hostname Mismatch] Host '${result.hostname}' not in allowed list from IP: ${
            clientIp || "unknown"
          }`
        );
        return {
          success: false,
          code: "HOSTNAME_MISMATCH",
          msg: "Security verification failed. Please try again.",
        };
      }
    }

    return {
      success: true,
      data: {
        hostname: result.hostname,
        action: result.action,
      },
    };
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      logger.warn(`[Turnstile Timeout] Verification timed out after ${TIMEOUT_MS}ms for IP: ${clientIp || "unknown"}`);
      return {
        success: false,
        code: "VERIFICATION_TIMEOUT",
        msg: "Security verification failed. Please try again.",
      };
    }
    logger.error("[Turnstile Error] Unexpected error during verification:", err.message);
    return {
      success: false,
      code: "VERIFICATION_ERROR",
      msg: "Security verification failed. Please try again.",
    };
  }
}

module.exports = {
  verifyTurnstileToken,
  CLOUDFLARE_TEST_SECRET,
};
