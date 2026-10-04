const router = require("express").Router();
const requestIdMiddleware = require("../../middlewares/requestId");
const { ipRateLimiter, apiRateLimiter } = require("../../middlewares/rateLimiter");
const { publicApiAuth } = require("../../middlewares/publicApiAuth");
const idempotencyMiddleware = require("../../middlewares/idempotency");

// 1. Request ID tagging on every public request
router.use(requestIdMiddleware);

// 2. Layer 1: IP Rate Limiting (Flood & Brute-force protection)
router.use(ipRateLimiter());

// 3. Public endpoints (No auth required)
router.use(require("./health"));
router.use(require("./openapi"));

// 4. Authenticated endpoints middleware chain
// - Layer 2 & 3: API Key & Workspace Rate Limiting
// - Idempotency tracking on mutating requests
router.use(publicApiAuth);
router.use(apiRateLimiter());
router.use(idempotencyMiddleware());

// 5. Mount feature sub-routers
router.use(require("./connections"));
router.use(require("./messages"));
router.use(require("./templates"));
router.use(require("./contacts"));
router.use(require("./usage"));

// 6. 404 Handler for unmatched /v1 routes
router.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ENDPOINT_NOT_FOUND",
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on Resend API v1.`,
      request_id: req.requestId,
    },
  });
});

module.exports = router;
