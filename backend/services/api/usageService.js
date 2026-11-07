const { prisma } = require("../../database/prisma");
const { intOrNull, monthRange, str, whereStr } = require("../../database/prismaHelpers");
const logger = require("../../utils/logger");

/**
 * Record a public API request / messaging event
 */
async function recordUsageEvent({
  uid,
  apiKeyId = null,
  connectionPublicId = null,
  endpoint,
  method,
  statusCode,
  messageId = null,
  messageStatus = null,
  durationMs = 0,
}) {
  if (!uid) return;

  try {
    await prisma.api_usage_events.create({
      data: {
        uid: str(uid),
        api_key_id: intOrNull(apiKeyId),
        connection_public_id: str(connectionPublicId),
        endpoint: str(endpoint),
        method: str(method),
        status_code: intOrNull(statusCode),
        message_id: str(messageId),
        message_status: str(messageStatus),
        duration_ms: intOrNull(durationMs),
      },
    });
  } catch (err) {
    logger.error("Failed to record API usage event:", err.message);
  }
}

/**
 * Get aggregate usage metrics for a workspace
 */
async function getAggregateUsage(uid, period = null) {
  const currentMonth = period || new Date().toISOString().slice(0, 7); // "YYYY-MM"

  try {
    // 1. Query usage events from api_usage_events
    const month = monthRange(currentMonth);
    const countBy = (rows, key, values) =>
      rows.filter((r) => values.includes(r[key])).reduce((n, r) => n + r._count._all, 0);

    const eventGroups = await prisma.api_usage_events.groupBy({
      by: ["message_status"],
      where: { uid: whereStr(uid), created_at: month },
      _count: { _all: true },
    });
    const eventStats = [
      {
        total_requests: eventGroups.reduce((n, r) => n + r._count._all, 0),
        accepted_count: countBy(eventGroups, "message_status", ["accepted"]),
        sent_count: countBy(eventGroups, "message_status", ["sent"]),
        delivered_count: countBy(eventGroups, "message_status", ["delivered"]),
        failed_count: countBy(eventGroups, "message_status", ["failed"]),
      },
    ];

    // 2. Also check beta_api_logs for broader message counts
    const logGroups = await prisma.beta_api_logs.groupBy({
      by: ["status"],
      where: { uid: whereStr(uid), createdAt: month },
      _count: { _all: true },
    });
    const logStats = [
      {
        total_logs: logGroups.reduce((n, r) => n + r._count._all, 0),
        accepted_logs: countBy(logGroups, "status", ["processing", "accepted"]),
        sent_logs: countBy(logGroups, "status", ["sent"]),
        delivered_logs: countBy(logGroups, "status", ["delivered"]),
        failed_logs: countBy(logGroups, "status", ["failed"]),
      },
    ];

    const events = eventStats[0] || {};
    const logs = logStats[0] || {};

    const apiRequests = parseInt(events.total_requests || 0, 10);
    const accepted = Math.max(
      parseInt(events.accepted_count || 0, 10),
      parseInt(logs.accepted_logs || 0, 10)
    );
    const sent = Math.max(
      parseInt(events.sent_count || 0, 10),
      parseInt(logs.sent_logs || 0, 10)
    );
    const delivered = Math.max(
      parseInt(events.delivered_count || 0, 10),
      parseInt(logs.delivered_logs || 0, 10)
    );
    const failed = Math.max(
      parseInt(events.failed_count || 0, 10),
      parseInt(logs.failed_logs || 0, 10)
    );

    return {
      period: currentMonth,
      api_requests: apiRequests,
      messages: {
        accepted,
        sent,
        delivered,
        failed,
      },
    };
  } catch (err) {
    logger.error("Error aggregating usage:", err);
    return {
      period: currentMonth,
      api_requests: 0,
      messages: {
        accepted: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      },
    };
  }
}

module.exports = {
  recordUsageEvent,
  getAggregateUsage,
};
