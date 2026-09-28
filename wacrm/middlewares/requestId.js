const crypto = require("crypto");

/**
 * Assigns a unique X-Request-ID to every incoming public API request
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length > 0
      ? incomingId.trim()
      : `req_${crypto.randomBytes(8).toString("hex")}`;

  req.requestId = requestId;
  req.startTime = Date.now();
  res.setHeader("X-Request-ID", requestId);

  next();
}

module.exports = requestIdMiddleware;
