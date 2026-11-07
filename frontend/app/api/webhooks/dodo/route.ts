import { NextRequest, NextResponse } from 'next/server';
import {
  verifyDodoWebhook,
  isEventProcessed,
  markEventProcessed,
  handlePaymentSucceeded,
  handleSubscriptionActive,
  DodoHandlerContext,
  DodoPaymentSucceededEvent,
  DodoSubscriptionActiveEvent,
} from '@/lib/dodo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/webhooks/dodo
 * Webhook endpoint for Dodo Payments.
 * Handles `payment.succeeded` and `subscription.active` events with:
 * - Standard Webhooks cryptographic signature verification
 * - Raw body preservation
 * - Replay attack prevention via timestamp tolerance
 * - Idempotency protection using `webhook-id`
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract raw body text - essential for cryptographic signature verification
    const rawBody = await request.text();

    // 2. Extract Standard Webhook headers
    const webhookId = request.headers.get('webhook-id') || '';
    const webhookSignature = request.headers.get('webhook-signature') || '';
    const webhookTimestamp = request.headers.get('webhook-timestamp') || '';

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required Standard Webhook headers (webhook-id, webhook-signature, webhook-timestamp).',
        },
        { status: 400 }
      );
    }

    // 3. Cryptographically verify webhook signature
    const verification = await verifyDodoWebhook(rawBody, request.headers);
    if (!verification.isValid || !verification.event) {
      console.warn(`[Dodo Webhook] Unauthorized request rejected: ${verification.error}`);
      return NextResponse.json(
        {
          success: false,
          error: verification.error || 'Invalid webhook signature.',
        },
        { status: verification.statusCode || 401 }
      );
    }

    const event = verification.event;
    const context: DodoHandlerContext = {
      webhookId,
      timestamp: webhookTimestamp,
      rawBody,
    };

    // 4. Idempotency Check: Prevent duplicate processing on Dodo retries
    const isDuplicate = await isEventProcessed(webhookId);
    if (isDuplicate) {
      console.log(`[Dodo Webhook] Duplicate event ${webhookId} safely skipped (idempotent).`);
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          message: 'Webhook event already processed.',
        },
        { status: 200 }
      );
    }

    // 5. Route event to corresponding handler
    let handlerResult: any = null;

    switch (event.type) {
      case 'payment.succeeded':
        handlerResult = await handlePaymentSucceeded(
          event as DodoPaymentSucceededEvent,
          context
        );
        break;

      case 'subscription.active':
        handlerResult = await handleSubscriptionActive(
          event as DodoSubscriptionActiveEvent,
          context
        );
        break;

      default:
        console.log(`[Dodo Webhook] Acknowledged unhandled event type: ${event.type}`);
        return NextResponse.json(
          {
            received: true,
            status: 'unhandled_event',
            eventType: event.type,
          },
          { status: 200 }
        );
    }

    // 6. Record event as processed in idempotency store
    await markEventProcessed(webhookId, event.type);

    return NextResponse.json(
      {
        received: true,
        success: true,
        event: event.type,
        id: webhookId,
        details: handlerResult?.data || null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Dodo Webhook] Processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while processing webhook.',
      },
      { status: 500 }
    );
  }
}
