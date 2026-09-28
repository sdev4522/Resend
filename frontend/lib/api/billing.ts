import { api } from './client';
import { API_ENDPOINTS } from '@/config/api';
import {
  SubscriptionPlan,
  UserPlanDetails,
  PriceCalculationSummary,
  CouponValidationResponse,
  CreateOrderResponse,
  VerifyPaymentPayload,
  VerifyPaymentResponse,
  BillingOrder,
  SupportedBillingCurrency,
} from '@/types/billing';

export const billingApi = {
  getPlans: () => {
    return api.get<{
      success: boolean;
      plans: SubscriptionPlan[];
      currency: string;
      currencySymbol: string;
      supportedCurrencies?: SupportedBillingCurrency[];
      durationDiscounts?: Record<string, number>;
    }>(API_ENDPOINTS.billing.plans);
  },

  calculatePrice: (payload: {
    planId: number;
    durationMonths?: number;
    couponCode?: string;
    currency?: string;
  }) => {
    return api.post<{ success: boolean; data: PriceCalculationSummary }>(
      API_ENDPOINTS.billing.calculatePrice,
      payload
    );
  },

  validateCoupon: (payload: {
    code: string;
    planId: number;
    durationMonths?: number;
    currency?: string;
  }) => {
    return api.post<CouponValidationResponse>(
      API_ENDPOINTS.billing.validateCoupon,
      payload
    );
  },

  createCheckoutOrder: (payload: {
    planId: number;
    couponCode?: string;
    autopay?: boolean;
    durationMonths?: number;
    currency?: string;
  }) => {
    return api.post<CreateOrderResponse & { isAutopay?: boolean; subscriptionId?: string }>(
      API_ENDPOINTS.billing.createOrder,
      payload
    );
  },

  verifyPayment: (payload: VerifyPaymentPayload & { razorpay_subscription_id?: string }) => {
    return api.post<VerifyPaymentResponse & { isAutopay?: boolean }>(
      API_ENDPOINTS.billing.verifyPayment,
      payload
    );
  },

  cancelAutopay: () => {
    return api.post<{ success: boolean; msg: string }>('/api/billing/cancel_autopay');
  },

  getOrders: () => {
    return api.get<{
      success: boolean;
      orders: BillingOrder[];
      autopay?: {
        subscriptionId: string | null;
        status: string | null;
        isActive: boolean;
      };
    }>(API_ENDPOINTS.billing.orders);
  },

  getPlanDetails: () => {
    return api.get<{ success: boolean; data: UserPlanDetails; msg?: string }>(
      "/api/user/get_plan_details"
    );
  },

  getPaymentDetails: () => {
    return api.get<{ success: boolean; data: any }>(API_ENDPOINTS.billing.details);
  },

  detectCurrency: () => {
    return api.get<{
      success: boolean;
      currency: string;
      symbol: string;
      country: string | null;
      source: string;
    }>("/api/billing/detect_currency");
  },
};
