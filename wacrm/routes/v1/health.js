const router = require("express").Router();

/**
 * GET /v1/health
 * Public health check for load balancers and monitoring
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

module.exports = router;
