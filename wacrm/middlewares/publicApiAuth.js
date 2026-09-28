const { validateApiKey } = require("../services/api/apiKeyService");
const { query } = require("../database/dbpromise");
const { resolveUserPlan, getAllEntitlements } = require("../helper/entitlements");
const logger = require("../utils/logger");

/**
 * Public Developer API Authentication Middleware
 * Requires Authorization: Bearer <API_KEY>
 */
async function publicApiAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const requestId = req.requestId || "req_unknown";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or invalid Authorization header. Expected 'Bearer <API_KEY>'.",
        request_id: requestId,
      },
    });
  }

  const rawKey = authHeader.slice(7).trim();

  try {
    const authResult = await validateApiKey(rawKey);

    if (!authResult.valid) {
      return res.status(401).json({
        error: {
          code: authResult.code || "INVALID_API_KEY",
          message: authResult.message || "Invalid API key.",
          request_id: requestId,
        },
      });
    }

    const { key, scopes } = authResult;

    // Resolve tenant workspace from user table
    const userRows = await query(`SELECT * FROM user WHERE uid = ? LIMIT 1`, [key.uid]);
    if (userRows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_API_KEY",
          message: "Workspace associated with this API key no longer exists.",
          request_id: requestId,
        },
      });
    }

    const user = userRows[0];

    // Resolve active subscription plan & entitlements
    const planResolution = await resolveUserPlan(user);
    if (!planResolution.isValid) {
      const code = planResolution.isExpired ? "PLAN_EXPIRED" : "NO_PLAN";
      return res.status(403).json({
        error: {
          code,
          message: planResolution.message || "Active subscription plan required to use Developer API.",
          request_id: requestId,
        },
      });
    }

    // Attach verified context to request
    req.apiKey = key;
    req.workspaceId = key.uid;
    req.user = user;
    req.plan = planResolution.plan;
    req.entitlements = getAllEntitlements(planResolution.plan);
    req.scopes = scopes;

    next();
  } catch (err) {
    logger.error("Error in publicApiAuth middleware:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal authentication error occurred.",
        request_id: requestId,
      },
    });
  }
}

/**
 * Granular scope verification middleware generator
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    const requestId = req.requestId || "req_unknown";
    const userScopes = req.scopes || [];

    if (!userScopes.includes(requiredScope)) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_SCOPE",
          message: `This API key is not authorized for the '${requiredScope}' scope.`,
          request_id: requestId,
        },
      });
    }

    next();
  };
}

module.exports = {
  publicApiAuth,
  requireScope,
};
