const router = require("express").Router();
const { requireScope } = require("../../middlewares/publicApiAuth");
const { getAuthorizedConnections } = require("../../services/connections/connectionService");
const logger = require("../../utils/logger");

/**
 * GET /v1/connections
 * Lists WhatsApp connections accessible to the authenticated API key
 */
router.get("/connections", requireScope("connections:read"), async (req, res) => {
  const requestId = req.requestId;

  try {
    const connections = await getAuthorizedConnections(
      req.workspaceId,
      req.apiKey?.id
    );

    // Standard envelope response
    res.status(200).json({
      data: connections,
      request_id: requestId,
    });
  } catch (err) {
    logger.error("Error listing connections:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve authorized WhatsApp connections.",
        request_id: requestId,
      },
    });
  }
});

module.exports = router;
