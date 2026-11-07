/**
 * Webhook Idempotency Store
 * Prevents duplicate processing of webhooks when Dodo Payments retries delivery.
 * Dodo Payments delivers up to 8 retries (immediately, 5s, 5m, 30m, 2h, 5h, 10h, 10h).
 */

interface IdempotencyRecord {
  id: string;
  eventType?: string;
  processedAt: number;
}

// In-memory cache with 24-hour TTL (86,400,000 ms)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const processedEvents = new Map<string, IdempotencyRecord>();

/**
 * Periodically purge records older than the TTL to prevent memory leaks.
 */
function cleanupExpiredRecords(ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  for (const [id, record] of processedEvents.entries()) {
    if (now - record.processedAt > ttlMs) {
      processedEvents.delete(id);
    }
  }
}

/**
 * Check whether a webhook event has already been processed.
 */
export async function isEventProcessed(
  webhookId: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<boolean> {
  if (!webhookId) return false;

  const record = processedEvents.get(webhookId);
  if (!record) return false;

  // Verify TTL freshness
  if (Date.now() - record.processedAt > ttlMs) {
    processedEvents.delete(webhookId);
    return false;
  }

  return true;
}

/**
 * Mark a webhook event as successfully processed.
 */
export async function markEventProcessed(
  webhookId: string,
  eventType?: string
): Promise<void> {
  if (!webhookId) return;

  processedEvents.set(webhookId, {
    id: webhookId,
    eventType,
    processedAt: Date.now(),
  });

  // Run a quick cleanup if map size grows large
  if (processedEvents.size > 2000) {
    cleanupExpiredRecords();
  }
}

/**
 * Clear the processed events cache (primarily for test environments).
 */
export function clearIdempotencyCache(): void {
  processedEvents.clear();
}
