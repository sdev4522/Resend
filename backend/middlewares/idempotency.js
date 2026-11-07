const crypto = require("crypto");
const { prisma } = require("../database/prisma");
const { idParam, plain, whereStr } = require("../database/prismaHelpers");
const logger = require("../utils/logger");

/**
 * Normalizes request payload and computes SHA-256 hash
 */
function computePayloadHash(body) {
  const jsonString = JSON.stringify(body || {}, Object.keys(body || {}).sort());
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}

/**
 * Mandatory Idempotency Middleware for mutating requests
 */
function idempotencyMiddleware() {
  return async (req, res, next) => {
    // Only apply to POST/PUT/DELETE
    if (!["POST", "PUT", "DELETE"].includes(req.method.toUpperCase())) {
      return next();
    }

    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return next(); // Key is optional per endpoint, but handled if provided
    }

    const cleanKey = idempotencyKey.trim();
    if (cleanKey.length === 0 || cleanKey.length > 255) {
      return res.status(400).json({
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "Idempotency-Key header must be a valid non-empty string under 255 characters.",
          request_id: req.requestId,
        },
      });
    }

    const uid = req.workspaceId || req.apiKey?.uid;
    if (!uid) {
      return next();
    }

    const payloadHash = computePayloadHash(req.body);

    try {
      // 1. Check existing record
      const rows = plain(await prisma.api_idempotency_keys.findMany({ where: { uid: whereStr(uid), idempotency_key: whereStr(cleanKey) }, take: 1 }));

      if (rows.length > 0) {
        const record = rows[0];

        // If payload differs materially, reject with 409
        if (record.request_hash !== payloadHash) {
          return res.status(409).json({
            error: {
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "This idempotency key was previously submitted with a different request payload.",
              request_id: req.requestId,
            },
          });
        }

        // Return cached response without repeating the operation
        let cachedBody = {};
        try {
          cachedBody = JSON.parse(record.response_body);
        } catch {
          cachedBody = record.response_body;
        }

        res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
        return res.status(record.response_status).json(cachedBody);
      }

      // 2. Intercept response to store result
      const originalJson = res.json.bind(res);

      res.json = function (body) {
        const statusCode = res.statusCode || 200;

        // Cache 2xx successful responses
        if (statusCode >= 200 && statusCode < 300) {
          const bodyString = typeof body === "string" ? body : JSON.stringify(body);
          const apiKeyId = req.apiKey?.id || 0;
          const requestPath = req.originalUrl || req.path;

          prisma.api_idempotency_keys
            .upsert({
              where: { uid_idempotency_key: { uid: String(uid), idempotency_key: String(cleanKey) } },
              create: {
                uid: String(uid),
                api_key_id: idParam(apiKeyId) > 0 ? idParam(apiKeyId) : 0,
                idempotency_key: String(cleanKey),
                request_path: String(requestPath).slice(0, 255),
                request_hash: String(payloadHash),
                response_status: statusCode,
                response_body: bodyString,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
              // former ON DUPLICATE KEY UPDATE
              update: { response_status: statusCode, response_body: bodyString },
            })
            .catch((err) => {
            logger.error("Failed to persist idempotency key record:", err.message);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.error("Error in idempotency middleware:", err);
      next();
    }
  };
}

module.exports = idempotencyMiddleware;
