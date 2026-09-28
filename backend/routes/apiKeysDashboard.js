const router = require("express").Router();
const validateUser = require("../middlewares/user");
const {
  generateApiKey,
  revokeApiKey,
  listApiKeys,
} = require("../services/api/apiKeyService");
const { getAuthorizedConnections } = require("../services/connections/connectionService");
const { getAggregateUsage } = require("../services/api/usageService");
const { resolveUserPlan, getAllEntitlements, getLimit } = require("../helper/entitlements");
const { DEFAULT_LIMITS } = require("../middlewares/rateLimiter");
const logger = require("../utils/logger");

// All dashboard endpoints require valid user session
router.use(validateUser);

/**
 * GET /api/user/api-keys
 * List existing API keys for current workspace
 */
router.get("/", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const keys = await listApiKeys(uid);
    res.status(200).json({ success: true, data: keys });
  } catch (err) {
    logger.error("Error listing API keys in dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to retrieve API keys" });
  }
});

/**
 * POST /api/user/api-keys
 * Create a new API key (Secret returned only once!)
 */
router.post("/", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const {
      name,
      scopes,
      allowed_connections,
      default_connection_id,
      expires_at,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ success: false, msg: "Key name is required" });
    }

    const createdKey = await generateApiKey({
      uid,
      name,
      scopes: Array.isArray(scopes) ? scopes : ["messages:send", "messages:read"],
      allowedConnections: Array.isArray(allowed_connections) ? allowed_connections : [],
      defaultConnectionId: default_connection_id || null,
      expiresAt: expires_at || null,
    });

    res.status(201).json({ success: true, data: createdKey });
  } catch (err) {
    logger.error("Error creating API key in dashboard:", err);
    res.status(400).json({ success: false, msg: err.message || "Failed to create API key" });
  }
});

/**
 * DELETE /api/user/api-keys/:id or POST /:id/revoke
 * Revoke an API key
 */
router.delete("/:id", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const keyId = req.params.id;

    const revoked = await revokeApiKey(keyId, uid);
    if (!revoked) {
      return res.status(404).json({ success: false, msg: "API key not found" });
    }

    res.status(200).json({ success: true, msg: "API key has been revoked" });
  } catch (err) {
    logger.error("Error revoking API key in dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to revoke API key" });
  }
});

router.post("/:id/revoke", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const keyId = req.params.id;

    const revoked = await revokeApiKey(keyId, uid);
    if (!revoked) {
      return res.status(404).json({ success: false, msg: "API key not found" });
    }

    res.status(200).json({ success: true, msg: "API key has been revoked" });
  } catch (err) {
    logger.error("Error revoking API key in dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to revoke API key" });
  }
});

/**
 * GET /api/user/api-keys/connections
 * Get workspace WhatsApp connections for key configuration
 */
router.get("/connections", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const connections = await getAuthorizedConnections(uid, null);
    res.status(200).json({ success: true, data: connections });
  } catch (err) {
    logger.error("Error fetching connections for dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch connections" });
  }
});

/**
 * GET /api/user/api-keys/limits
 * Get real effective rate limits and plan quotas
 */
router.get("/limits", async (req, res) => {
  try {
    const user = req.decode;
    const planRes = await resolveUserPlan(user);
    const plan = planRes.plan || {};

    const contactLimit = getLimit(plan, "contacts");
    const qrAccountLimit = getLimit(plan, "qr_accounts");
    const entitlements = getAllEntitlements(plan);

    res.status(200).json({
      success: true,
      data: {
        requests_per_minute: DEFAULT_LIMITS.KEY_REQ_PER_MIN,
        messages_per_minute: DEFAULT_LIMITS.CONNECTION_MSG_PER_MIN,
        workspace_requests_per_minute: DEFAULT_LIMITS.WORKSPACE_REQ_PER_MIN,
        monthly_quota: parseInt(plan.custom?.message_quota || contactLimit || "100000", 10),
        connections_limit: qrAccountLimit || 5,
        api_allowed: entitlements.api,
      },
    });
  } catch (err) {
    logger.error("Error fetching limits for dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch effective limits" });
  }
});

/**
 * GET /api/user/api-keys/stats
 * Get real usage metrics for dashboard
 */
router.get("/stats", async (req, res) => {
  try {
    const uid = req.decode.uid;
    const period = req.query.period || null;
    const stats = await getAggregateUsage(uid, period);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    logger.error("Error fetching usage stats for dashboard:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch usage stats" });
  }
});

module.exports = router;
