/**
 * Dodo Payments Standard Webhook Verifier
 * Cryptographic signature verification using Standard Webhooks specification.
 */

import { Webhook } from 'standardwebhooks';
import { DodoVerifyResult, DodoWebhookEvent } from './types';

/**
 * Normalizes signing secrets for the Standard Webhooks verifier.
 * Standard Webhooks expects the secret to be base64-encoded (or prefixed with `whsec_`).
 */
export function normalizeDodoWebhookSecret(rawSecret: string): string {
  const secret = rawSecret.trim();
  if (secret.startsWith('whsec_')) {
    return secret;
  }

  // Check if string is already valid base64
  try {
    const buf = Buffer.from(secret, 'base64');
    if (buf.toString('base64') === secret && buf.length > 0) {
      return secret;
    }
  } catch {
    // Not valid base64, proceed to prefix
  }

  return 'whsec_' + Buffer.from(secret).toString('base64');
}

/**
 * Verifies a Dodo Payments webhook request.
 *
 * @param rawBody - Raw body text of the incoming request (must not be JSON.parse'd beforehand)
 * @param headers - Request headers map or Headers instance
 * @param customSecret - Optional override for webhook secret; defaults to process.env.DODO_PAYMENTS_WEBHOOK_KEY
 */
export async function verifyDodoWebhook<T = any>(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
  customSecret?: string
): Promise<DodoVerifyResult<T>> {
  const secret =
    customSecret ||
    process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  if (!secret) {
    return {
      isValid: false,
      error: 'Dodo Payments webhook secret is not configured in environment variables (DODO_PAYMENTS_WEBHOOK_KEY).',
      statusCode: 500,
    };
  }

  // Extract required Standard Webhooks headers
  const getHeader = (key: string): string => {
    if (typeof (headers as any)?.get === 'function') {
      return (headers as Headers).get(key) || '';
    }
    const record = headers as Record<string, string | null | undefined>;
    return (record[key] || record[key.toLowerCase()] || '') as string;
  };

  const webhookId = getHeader('webhook-id');
  const webhookSignature = getHeader('webhook-signature');
  const webhookTimestamp = getHeader('webhook-timestamp');

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return {
      isValid: false,
      error: `Missing required Standard Webhook headers. Required: webhook-id, webhook-signature, webhook-timestamp.`,
      statusCode: 400,
    };
  }

  try {
    const normalizedKey = normalizeDodoWebhookSecret(secret);
    const verifier = new Webhook(normalizedKey);

    const verifiedPayload = verifier.verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    }) as DodoWebhookEvent<T>;

    return {
      isValid: true,
      event: verifiedPayload,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || 'Webhook signature verification failed.',
      statusCode: 401,
    };
  }
}
