const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { getAggregateUsage } = require("../../services/api/usageService");
const logger = require("../../utils/logger");

/**
 * GET /v1/usage
 * Aggregate usage metrics for the authenticated workspace
 */
router.get("/usage", requireScope("usage:read"), async (req, res) => {
  const requestId = req.requestId;
  const period = req.query.period || null;

  try {
    const stats = await getAggregateUsage(req.workspaceId, period);

    return res.status(200).json({
      data: stats,
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error in GET /v1/usage:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve usage data.",
        request_id: requestId,
      },
    });
  }
});

module.exports = router;
