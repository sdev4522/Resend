export interface SupportedBillingCurrency {
  code: string;
  symbol: string;
  rate: number;
  name?: string;
  enabled?: boolean;
}

export interface SubscriptionPlan {
  id: number;
  title: string;
  short_description?: string;
  description?: string;
  price: number;
  price_strike?: string | null;
  plan_duration_in_days?: string | number;
  duration_days?: number;
  is_trial?: number;
  contact_limit?: string | number;
  qr_account?: number;
  allow_tag?: number;
  allow_note?: number;
  allow_chatbot?: number;
  allow_api?: number;
  wa_warmer?: number;
  rest_api_qr?: number;
  instagram_inbox?: number;
  telegram_inbox?: number;
  allow_wa_forms?: number;
  messenger_inbox?: number;
  is_popular?: boolean;
  currencyPrices?: Record<string, number>;
  currencyStrikePrices?: Record<string, number>;
  custom?: any;
  plan_prices?: any[];
}

export interface PaymentOrder {
  id: number;
  order_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  gateway: 'stripe' | 'paypal' | 'razorpay' | 'manual';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  created_at: string;
}

export interface PriceCalculationSummary {
  plan: {
    id: number;
    title: string;
    price: number;
    plan_duration_in_days: number;
    total_days: number;
  };
  durationMonths: number;
  currency: string;
  currencySymbol: string;
  baseSubtotal: number;
  durationDiscountRate: number;
  durationDiscount: number;
  subtotalAfterDuration: number;
  couponCode: string | null;
  couponDiscount: number;
  couponMessage: string | null;
  taxRate: number;
  taxAmount: number;
  finalAmount: number;
  amountMinor: number;
}

export interface CouponValidationResponse {
  success: boolean;
  valid: boolean;
  couponCode: string;
  discountAmount: number;
  message: string;
  pricing: PriceCalculationSummary;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  isAutopay?: boolean;
  internalOrderId: number;
  amount: number;
  currency: string;
  keyId: string;
  pricing: PriceCalculationSummary;
  isMock?: boolean;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  msg: string;
  plan?: any;
  newExpiry?: number;
  alreadyProcessed?: boolean;
}

export interface BillingOrder {
  id: number;
  isAutopay?: boolean;
  paymentMode: string;
  amount: string;
  status: string;
  createdAt: string;
  orderId: string;
  planTitle: string;
  durationMonths: number;
  couponCode: string | null;
  couponDiscount: number;
  currency: string;
  razorpayPaymentId: string | null;
}

export interface UserPlanDetails {
  isValid: boolean;
  isExpired: boolean;
  daysLeft: number;
  plan_expire: string | number;
  plan: {
    id: number;
    title: string;
    short_description?: string;
    price?: number;
    price_strike?: string | null;
    plan_duration_in_days?: number;
    is_trial?: number;
    contact_limit?: number;
    qr_account?: number;
    allow_tag?: number;
    allow_note?: number;
    allow_chatbot?: number;
    allow_api?: number;
    wa_warmer?: number;
    rest_api_qr?: number;
    instagram_inbox?: number;
    telegram_inbox?: number;
    allow_wa_forms?: number;
  } | null;
  usage: {
    contacts: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
    qr_accounts: {
      used: number;
      limit: number;
      remaining: number;
      percentage: number;
    };
  };
  entitlements: {
    tags: boolean;
    notes: boolean;
    chatbot: boolean;
    api: boolean;
    wa_warmer: boolean;
    rest_api_qr: boolean;
    instagram_inbox: boolean;
    telegram_inbox: boolean;
    allow_wa_forms: boolean;
    messenger_inbox: boolean;
  };
}
