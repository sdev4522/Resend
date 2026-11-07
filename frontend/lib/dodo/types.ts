/**
 * Dodo Payments Webhook Types
 * Comprehensive type definitions matching Dodo Payments & Standard Webhooks specification.
 */

export interface DodoCustomer {
  customer_id: string;
  email: string;
  name?: string;
  phone?: string | null;
}

export interface DodoServicePeriod {
  start_at: string;
  end_at: string;
}

export interface DodoPaymentData {
  payload_type: 'Payment';
  payment_id: string;
  status: 'succeeded' | 'failed' | 'processing' | 'cancelled' | string;
  currency: string;
  total_amount: number;
  customer: DodoCustomer;
  metadata?: Record<string, any>;
  payment_provider?: string;
  service_periods?: DodoServicePeriod[];
  created_at?: string;
  refunds?: Array<Record<string, any>>;
  retry_attempt?: number;
  [key: string]: any;
}

export interface DodoSubscriptionData {
  payload_type: 'Subscription';
  subscription_id: string;
  status: 'active' | 'pending' | 'on_hold' | 'paused' | 'cancelled' | 'expired' | 'past_due' | string;
  currency: string;
  recurring_price: number;
  billing_interval: 'day' | 'week' | 'month' | 'year' | string;
  billing_frequency?: number;
  customer: DodoCustomer;
  product_id?: string;
  next_billing_date?: string;
  created_at?: string;
  metadata?: Record<string, any>;
  cancelled_at?: string | null;
  trial_period_days?: number;
  [key: string]: any;
}

export interface DodoWebhookEvent<TData = any> {
  business_id: string;
  type: string;
  timestamp: string;
  data: TData;
}

export type DodoPaymentSucceededEvent = DodoWebhookEvent<DodoPaymentData>;
export type DodoSubscriptionActiveEvent = DodoWebhookEvent<DodoSubscriptionData>;

export interface DodoWebhookHeaders {
  'webhook-id': string;
  'webhook-signature': string;
  'webhook-timestamp': string;
  [key: string]: string | undefined;
}

export interface DodoVerifyResult<T = any> {
  isValid: boolean;
  event?: DodoWebhookEvent<T>;
  error?: string;
  statusCode?: number;
}

export interface DodoHandlerContext {
  webhookId: string;
  timestamp: string;
  rawBody: string;
}

export interface DodoHandlerResponse {
  success: boolean;
  message?: string;
  data?: Record<string, any>;
}

export type DodoWebhookListener<T = any> = (
  event: DodoWebhookEvent<T>,
  context: DodoHandlerContext
) => Promise<DodoHandlerResponse | void> | DodoHandlerResponse | void;
