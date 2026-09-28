const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { resolveAndAuthorizeConnection } = require("../../services/connections/connectionService");
const {
  dispatchPublicMessage,
  getPublicMessageStatus,
} = require("../../services/messaging/publicMessageService");
const {
  checkConnectionRateLimit,
  checkPlanMonthlyQuota,
} = require("../../middlewares/rateLimiter");
const { recordUsageEvent } = require("../../services/api/usageService");
const logger = require("../../utils/logger");

const ALLOWED_MESSAGE_TYPES = ["text", "image", "video", "audio", "document"];

/**
 * POST /v1/messages
 * Send a WhatsApp message (text, media, document)
 */
router.post("/messages", requireScope("messages:send"), async (req, res) => {
  const requestId = req.requestId;
  const startTime = req.startTime || Date.now();
  const { connection_id, to, type, ...content } = req.body || {};

  // 1. Validate recipient
  if (!to || typeof to !== "string" || to.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Field 'to' (recipient phone number) is required.",
        request_id: requestId,
      },
    });
  }

  // 2. Validate message type
  if (!type || !ALLOWED_MESSAGE_TYPES.includes(type.toLowerCase())) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: `Field 'type' must be one of: ${ALLOWED_MESSAGE_TYPES.join(", ")}.`,
        request_id: requestId,
      },
    });
  }

  const normalizedType = type.toLowerCase();

  // 3. Validate content object based on type
  if (normalizedType === "text" && (!content.text?.body || typeof content.text.body !== "string")) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Text message requires a 'text.body' string property.",
        request_id: requestId,
      },
    });
  }

  if (normalizedType === "image" && (!content.image?.url && !content.image?.link)) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Image message requires an 'image.url' or 'image.link' property.",
        request_id: requestId,
      },
    });
  }

  if (normalizedType === "video" && (!content.video?.url && !content.video?.link)) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Video message requires a 'video.url' or 'video.link' property.",
        request_id: requestId,
      },
    });
  }

  if (normalizedType === "audio" && (!content.audio?.url && !content.audio?.link)) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Audio message requires an 'audio.url' or 'audio.link' property.",
        request_id: requestId,
      },
    });
  }

  if (normalizedType === "document" && (!content.document?.url && !content.document?.link)) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Document message requires a 'document.url' or 'document.link' property.",
        request_id: requestId,
      },
    });
  }

  try {
    // 4. Resolve and authorize WhatsApp connection
    const resolved = await resolveAndAuthorizeConnection({
      uid: req.workspaceId,
      apiKey: req.apiKey,
      connectionId: connection_id,
    });

    if (resolved.error) {
      return res.status(resolved.statusCode || 400).json({
        error: {
          code: resolved.error,
          message: resolved.message,
          request_id: requestId,
        },
      });
    }

    // 5. Layer 4: Connection Throughput Rate Limiting
    const connRate = await checkConnectionRateLimit(resolved.connection.public_id);
    if (!connRate.allowed) {
      res.setHeader("Retry-After", connRate.retryAfter);
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Connection message throughput limit reached (${connRate.limit}/min) to protect your WhatsApp account. Please retry in ${connRate.retryAfter}s.`,
          request_id: requestId,
        },
      });
    }

    // 6. Layer 5: Plan Monthly Quota Enforcement
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

    // 7. Dispatch message via authoritative provider engine
    const result = await dispatchPublicMessage({
      uid: req.workspaceId,
      apiKey: req.apiKey,
      resolvedConn: resolved,
      recipient: to.trim(),
      type: normalizedType,
      messagePayload: content,
    });

    const durationMs = Date.now() - startTime;

    // 8. Record Usage Event
    await recordUsageEvent({
      uid: req.workspaceId,
      apiKeyId: req.apiKey.id,
      connectionPublicId: resolved.connection.public_id,
      endpoint: "/v1/messages",
      method: "POST",
      statusCode: result.statusCode || (result.success ? 202 : 400),
      messageId: result.data?.id || null,
      messageStatus: result.data?.status || (result.success ? "accepted" : "failed"),
      durationMs,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: {
          code: result.error || "MESSAGE_INVALID",
          message: result.message || "Failed to deliver message.",
          request_id: requestId,
        },
      });
    }

    // Success response with stable public message ID
    return res.status(result.statusCode || 202).json({
      data: result.data,
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in POST /v1/messages:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while processing the message request.",
        request_id: requestId,
      },
    });
  }
});

/**
 * GET /v1/messages/:id
 * Retrieve authoritative message status (workspace isolated)
 */
router.get("/messages/:id", requireScope("messages:read"), async (req, res) => {
  const requestId = req.requestId;
  const messageId = req.params.id;

  if (!messageId || typeof messageId !== "string") {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Message ID parameter is required.",
        request_id: requestId,
      },
    });
  }

  try {
    const result = await getPublicMessageStatus(messageId.trim(), req.workspaceId);

    if (!result.success) {
      return res.status(result.statusCode || 404).json({
        error: {
          code: result.error || "MESSAGE_NOT_FOUND",
          message: result.message || "Message not found.",
          request_id: requestId,
        },
      });
    }

    return res.status(200).json({
      data: result.data,
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in GET /v1/messages/:id:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while retrieving message status.",
        request_id: requestId,
      },
    });
  }
});

module.exports = router;
