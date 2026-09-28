const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { resolveAndAuthorizeConnection } = require("../../services/connections/connectionService");
const { dispatchPublicTemplateMessage } = require("../../services/messaging/publicMessageService");
const {
  checkConnectionRateLimit,
  checkPlanMonthlyQuota,
} = require("../../middlewares/rateLimiter");
const { recordUsageEvent } = require("../../services/api/usageService");
const { query } = require("../../database/dbpromise");
const logger = require("../../utils/logger");

/**
 * GET /v1/templates
 * Lists approved WhatsApp templates available for the workspace
 */
router.get("/templates", requireScope("templates:read"), async (req, res) => {
  const requestId = req.requestId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const countRows = await query(
      `SELECT COUNT(*) as total FROM templets WHERE uid = ?`,
      [req.workspaceId]
    );
    const total = countRows[0]?.total || 0;

    const rows = await query(
      `SELECT id, title, type, content, createdAt FROM templets 
       WHERE uid = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [req.workspaceId, limit, offset]
    );

    const templates = rows.map((r) => {
      let parsedContent = null;
      try {
        parsedContent = typeof r.content === "string" ? JSON.parse(r.content) : r.content;
      } catch {}

      return {
        id: `tpl_${r.id}`,
        name: r.title,
        category: r.type || "MARKETING",
        status: "APPROVED",
        components: parsedContent || [],
        created_at: r.createdAt,
      };
    });

    return res.status(200).json({
      data: templates,
      pagination: {
        page,
        limit,
        total,
        has_more: offset + rows.length < total,
      },
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in GET /v1/templates:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve templates.",
        request_id: requestId,
      },
    });
  }
});

/**
 * POST /v1/template-messages
 * Send an approved Meta WhatsApp template
 * Strictly rejects QR/Baileys connections with TEMPLATE_NOT_SUPPORTED_BY_CONNECTION
 */
router.post("/template-messages", requireScope("templates:send"), async (req, res) => {
  const requestId = req.requestId;
  const startTime = req.startTime || Date.now();
  const { connection_id, to, template_name, language_code, components } = req.body || {};

  // 1. Validate required fields
  if (!to || typeof to !== "string" || to.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Field 'to' (recipient phone number) is required.",
        request_id: requestId,
      },
    });
  }

  if (!template_name || typeof template_name !== "string" || template_name.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Field 'template_name' is required.",
        request_id: requestId,
      },
    });
  }

  try {
    // 2. Resolve WhatsApp connection (defer active check to enforce provider compatibility rule first)
    const resolved = await resolveAndAuthorizeConnection({
      uid: req.workspaceId,
      apiKey: req.apiKey,
      connectionId: connection_id,
      requireActive: false,
    });

    if (resolved.error && resolved.error !== "CONNECTION_DISCONNECTED") {
      return res.status(resolved.statusCode || 400).json({
        error: {
          code: resolved.error,
          message: resolved.message,
          request_id: requestId,
        },
      });
    }

    // 3. Strict Rule: QR Connections CANNOT send Meta templates!
    if (resolved.provider === "qr") {
      return res.status(400).json({
        error: {
          code: "TEMPLATE_NOT_SUPPORTED_BY_CONNECTION",
          message: "Meta WhatsApp templates are only available for Meta Cloud API connections.",
          request_id: requestId,
        },
      });
    }

    if (resolved.error) {
      return res.status(resolved.statusCode || 400).json({
        error: {
          code: resolved.error,
          message: resolved.message,
          request_id: requestId,
        },
      });
    }

    // 4. Layer 4: Connection Throughput Rate Limiting
    const connRate = await checkConnectionRateLimit(resolved.connection.public_id);
    if (!connRate.allowed) {
      res.setHeader("Retry-After", connRate.retryAfter);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Connection message throughput limit reached. Please retry in ${connRate.retryAfter}s.`,
          request_id: requestId,
        },
      });
    }

    // 5. Layer 5: Monthly Quota
    const quotaCheck = await checkPlanMonthlyQuota(req.workspaceId, req.plan);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: {
          code: "QUOTA_EXCEEDED",
          message: `Monthly message quota exceeded (${quotaCheck.used}/${quotaCheck.limit}). Please upgrade your plan.`,
          request_id: requestId,
        },
      });
    }

    // 6. Dispatch template message
    const result = await dispatchPublicTemplateMessage({
      uid: req.workspaceId,
      apiKey: req.apiKey,
      resolvedConn: resolved,
      recipient: to.trim(),
      templateName: template_name.trim(),
      languageCode: language_code || "en_US",
      components: components || [],
    });

    const durationMs = Date.now() - startTime;

    // 7. Record Usage
    await recordUsageEvent({
      uid: req.workspaceId,
      apiKeyId: req.apiKey.id,
      connectionPublicId: resolved.connection.public_id,
      endpoint: "/v1/template-messages",
      method: "POST",
      statusCode: result.statusCode || (result.success ? 202 : 400),
      messageId: result.data?.id || null,
      messageStatus: result.data?.status || (result.success ? "accepted" : "failed"),
      durationMs,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: {
          code: result.error || "PROVIDER_ERROR",
          message: result.message || "Failed to send template message.",
          request_id: requestId,
        },
      });
    }

    return res.status(result.statusCode || 202).json({
      data: result.data,
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in POST /v1/template-messages:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while processing the template message.",
        request_id: requestId,
      },
    });
  }
});

module.exports = router;
