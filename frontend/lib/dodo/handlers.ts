/**
 * Dodo Payments Webhook Event Handlers
 * Dedicated handlers for `payment.succeeded` and `subscription.active` events.
 */

import {
  DodoPaymentSucceededEvent,
  DodoSubscriptionActiveEvent,
  DodoHandlerContext,
  DodoHandlerResponse,
  DodoWebhookListener,
} from './types';

// Registry for custom event subscribers
const eventListeners = new Map<string, DodoWebhookListener[]>();

/**
 * Register a custom listener callback for a specific Dodo Payments webhook event.
 * Useful for attaching app-specific business logic (e.g., email notifications, internal CRM hooks).
 */
export function registerDodoWebhookListener<T = any>(
  eventType: string,
  listener: DodoWebhookListener<T>
): () => void {
  const current = eventListeners.get(eventType) || [];
  eventListeners.set(eventType, [...current, listener as DodoWebhookListener]);

  // Return unsubscribe function
  return () => {
    const list = eventListeners.get(eventType) || [];
    eventListeners.set(
      eventType,
      list.filter((l) => l !== listener)
    );
  };
}

/**
 * Dispatch an event to all registered custom listeners.
 */
async function notifyListeners(
  eventType: string,
  event: any,
  context: DodoHandlerContext
): Promise<void> {
  const listeners = eventListeners.get(eventType) || [];
  for (const listener of listeners) {
    try {
      await listener(event, context);
    } catch (err) {
      console.error(`[Dodo Webhook] Custom listener error on ${eventType}:`, err);
    }
  }
}

/**
 * Handler for `payment.succeeded`
 * Fires when a payment (one-time or recurring checkout) is completed successfully.
 */
export async function handlePaymentSucceeded(
  event: DodoPaymentSucceededEvent,
  context: DodoHandlerContext
): Promise<DodoHandlerResponse> {
  const { data } = event;
  const paymentId = data.payment_id;
  const customerEmail = data.customer?.email;
  const customerId = data.customer?.customer_id;
  const totalAmount = data.total_amount;
  const currency = data.currency;
  const metadata = data.metadata || {};

  console.log(`[Dodo Webhook] ✅ payment.succeeded received:`, {
    paymentId,
    customerEmail,
    customerId,
    totalAmount,
    currency,
    metadata,
    webhookId: context.webhookId,
  });

  // Execute registered application-level subscribers
  await notifyListeners('payment.succeeded', event, context);

  // PAY-04: Forward verified event to backend for DB idempotency & plan credit
  try {
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY || '';
    await fetch(`${backendUrl}/api/user/dodo_payment_success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({
        webhookId: context.webhookId,
        eventType: 'payment.succeeded',
        paymentId,
        customerId,
        customerEmail,
        amount: totalAmount,
        currency,
        metadata,
      }),
    });
  } catch (backendErr) {
    console.error(`[Dodo Webhook] Failed to reach backend for payment ${paymentId}:`, backendErr);
  }

  return {
    success: true,
    message: `Payment ${paymentId} processed successfully.`,
    data: {
      paymentId,
      customerId,
      customerEmail,
      amount: totalAmount,
      currency,
      status: 'succeeded',
    },
  };
}

/**
 * Handler for `subscription.active`
 * Fires when a recurring subscription is established and recurring charges are activated.
 */
export async function handleSubscriptionActive(
  event: DodoSubscriptionActiveEvent,
  context: DodoHandlerContext
): Promise<DodoHandlerResponse> {
  const { data } = event;
  const subscriptionId = data.subscription_id;
  const customerEmail = data.customer?.email;
  const customerId = data.customer?.customer_id;
  const recurringPrice = data.recurring_price;
  const currency = data.currency;
  const billingInterval = data.billing_interval;
  const nextBillingDate = data.next_billing_date;
  const metadata = data.metadata || {};

  console.log(`[Dodo Webhook] 🚀 subscription.active received:`, {
    subscriptionId,
    customerEmail,
    customerId,
    recurringPrice,
    currency,
    billingInterval,
    nextBillingDate,
    metadata,
    webhookId: context.webhookId,
  });

  // Execute registered application-level subscribers
  await notifyListeners('subscription.active', event, context);

  // PAY-04: Forward verified subscription event to backend for DB idempotency & plan credit
  try {
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY || '';
    await fetch(`${backendUrl}/api/user/dodo_payment_success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({
        webhookId: context.webhookId,
        eventType: 'subscription.active',
        subscriptionId,
        customerId,
        customerEmail,
        amount: recurringPrice,
        currency,
        metadata,
      }),
    });
  } catch (backendErr) {
    console.error(`[Dodo Webhook] Failed to reach backend for subscription ${subscriptionId}:`, backendErr);
  }

  return {
    success: true,
    message: `Subscription ${subscriptionId} activated successfully.`,
    data: {
      subscriptionId,
      customerId,
      customerEmail,
      status: 'active',
      nextBillingDate,
    },
  };
}
