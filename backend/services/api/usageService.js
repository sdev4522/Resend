const { query } = require("../../database/dbpromise");
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
    await query(
      `INSERT INTO api_usage_events 
       (uid, api_key_id, connection_public_id, endpoint, method, status_code, message_id, message_status, duration_ms) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        apiKeyId,
        connectionPublicId,
        endpoint,
        method,
        statusCode,
        messageId,
        messageStatus,
        durationMs,
      ]
    );
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
    const eventStats = await query(
      `SELECT 
         COUNT(*) as total_requests,
         SUM(CASE WHEN message_status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
         SUM(CASE WHEN message_status = 'sent' THEN 1 ELSE 0 END) as sent_count,
         SUM(CASE WHEN message_status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
         SUM(CASE WHEN message_status = 'failed' THEN 1 ELSE 0 END) as failed_count
       FROM api_usage_events
       WHERE uid = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
      [uid, currentMonth]
    );

    // 2. Also check beta_api_logs for broader message counts
    const logStats = await query(
      `SELECT 
         COUNT(*) as total_logs,
         SUM(CASE WHEN status = 'processing' OR status = 'accepted' THEN 1 ELSE 0 END) as accepted_logs,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_logs,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_logs,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_logs
       FROM beta_api_logs
       WHERE uid = ? AND DATE_FORMAT(createdAt, '%Y-%m') = ?`,
      [uid, currentMonth]
    );

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
