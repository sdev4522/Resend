export interface AdminOverviewStats {
  total_users: number;
  active_subscriptions: number;
  total_revenue: number;
  messages_sent_today: number;
  active_instances: number;
  system_health: 'healthy' | 'degraded' | 'error';
}

export interface AdminUserListItem {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'agent' | 'admin';
  mobile_with_country_code?: string;
  timezone?: string;
  plan?: string | null;
  plan_expire?: string | null;
  trial?: number;
  createdAt?: string;
  tokenVersion?: number;
  is_blocked?: number | boolean;
}

export type { AdminUserDetails } from './analytics';

export interface AdminPlanItem {
  id: number;
  title: string;
  short_description?: string;
  allow_tag?: number;
  allow_note?: number;
  allow_chatbot?: number;
  contact_limit?: string | number;
  allow_api?: number;
  is_trial?: number;
  price?: number;
  price_strike?: string | null;
  plan_duration_in_days?: string | number;
  qr_account?: number;
  wa_warmer?: number;
  rest_api_qr?: number;
  instagram_inbox?: number;
  telegram_inbox?: number;
  allow_wa_forms?: number;
  createdAt?: string;
}

export interface AdminProfileData {
  id: number;
  uid: string;
  email: string;
  role: 'admin';
  createdAt?: string;
  tokenVersion?: number;
}

export interface PlanPriceItem {
  id?: number;
  plan_id: number;
  currency_code: string;
  amount: number | string;
  strike_amount?: number | string | null;
  billing_period_days: number;
  is_active: number | boolean;
}

export interface PppBenchmarkItem {
  ratio: number;
  forexRate: number;
  symbol: string;
  name: string;
}

export interface AdminWorkspaceItem {
  id: number;
  uid: string;
  name: string;
  email: string;
  mobile?: string;
  timezone?: string;
  is_blocked: boolean;
  createdAt: string;
  planTitle: string;
  planExpire?: string | null;
  parsedPlan?: any;
  stats: {
    members: number;
    qrInstances: number;
    metaInstances: number;
    totalInstances: number;
    contacts: number;
    campaigns: number;
  };
}

export interface AdminWhatsAppInstanceItem {
  id: number;
  uid: string;
  uniqueId: string;
  title: string;
  number: string;
  type: 'QR' | 'META';
  status: string;
  isLiveSession: boolean;
  createdAt: string;
  owner: {
    name: string;
    email: string;
    isBlocked: boolean;
  };
}

export interface AdminSubscriptionItem {
  id: number;
  uid: string;
  userName: string;
  userEmail: string;
  planTitle: string;
  isTrial: boolean;
  planDurationDays: number;
  price: number | string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  planExpire?: string | null;
  subscriptionId?: string | null;
  paymentMode: string;
  lastPaidAt?: string | null;
  createdAt: string;
}

export interface AdminUsageSummaryItem {
  id: number;
  uid: string;
  name: string;
  email: string;
  planTitle: string;
  usageRisk: 'NORMAL' | 'NEAR_LIMIT' | 'LIMIT_REACHED';
  contacts: {
    used: number;
    limit: number;
    percent: number;
  };
  instances: {
    used: number;
    limit: number;
    percent: number;
  };
  chatbots: {
    activeCount: number;
    allowed: boolean;
  };
  campaigns: number;
}

