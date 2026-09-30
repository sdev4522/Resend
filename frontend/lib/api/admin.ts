import { api } from './client';
import { API_ENDPOINTS } from '@/config/api';
import { 
  AdminOverviewStats, 
  AdminUserListItem, 
  AdminPlanItem, 
  AdminProfileData, 
  PlanPriceItem, 
  PppBenchmarkItem,
  AdminWorkspaceItem,
  AdminWhatsAppInstanceItem,
  AdminSubscriptionItem,
  AdminUsageSummaryItem,
} from '@/types/admin';
import { AdminMetaConfig } from '@/types/meta';



export interface SupportedCurrencyItem {
  code: string;
  symbol: string;
  rate: number;
  name: string;
  enabled: boolean;
}

export interface CurrencySettingsData {
  baseCode: string;
  baseSymbol: string;
  baseExchangeRate: number;
  roundingMode?: string;
  supportedCurrencies: SupportedCurrencyItem[];
}

export const adminApi = {
  getStats: () => {
    return api.get<{ success: boolean; data: AdminOverviewStats }>(API_ENDPOINTS.admin.stats);
  },

  getUsers: () => {
    return api.get<{ success: boolean; data: AdminUserListItem[] }>(API_ENDPOINTS.admin.users);
  },

  getPlans: () => {
    return api.get<{ success: boolean; data: AdminPlanItem[]; msg?: string }>(API_ENDPOINTS.admin.plans);
  },

  getPayments: () => {
    return api.get<{ success: boolean; data: any[] }>(API_ENDPOINTS.admin.payments);
  },

  getPaymentOrders: () => {
    return api.get<{ success: boolean; orders: any[] }>('/api/admin/get_payment_orders');
  },

  getAdminProfile: () => {
    return api.get<{ success: boolean; data: AdminProfileData }>('/api/admin/get_admin');
  },

  updateAdminProfile: (payload: { email: string; newpass?: string }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/update-admin', payload);
  },

  updateUser: (payload: {
    uid: string;
    name: string;
    email: string;
    mobile_with_country_code: string;
    newPassword?: string;
  }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/update_user', payload);
  },

  createPlan: (payload: Partial<AdminPlanItem>) => {
    return api.post<{ success: boolean; msg: string }>("/api/admin/add_plan", payload);
  },

  updatePlan: (payload: Partial<AdminPlanItem> & { id: number }) => {
    return api.post<{ success: boolean; msg: string }>("/api/admin/update_plan_data", payload);
  },

  deletePlan: (id: number) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/del_plan', { id });
  },

  getMetaConfig: () => {
    return api.get<{ success: boolean; data: AdminMetaConfig }>('/api/admin/get_embed_config');
  },

  updateMetaConfig: (payload: {
    appId: string;
    configId: string;
    graphVersion?: string;
    appSecret?: string;
  }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/update_embed_config', payload);
  },

  getRazorpaySettings: () => {
    return api.get<{
      success: boolean;
      data: {
        rz_id: string;
        rz_active: boolean;
        has_rz_key: boolean;
        rz_webhook_secret: string;
      };
    }>('/api/admin/get_razorpay_settings');
  },

  updateRazorpaySettings: (payload: {
    rz_id: string;
    rz_key?: string;
    rz_active: boolean | number;
    rz_webhook_secret?: string;
  }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/update_razorpay_settings', payload);
  },

  getCurrencySettings: () => {
    return api.get<{
      success: boolean;
      data: CurrencySettingsData;
    }>("/api/admin/currency_settings");
  },

  updateCurrencySettings: (payload: {
    baseCode: string;
    baseSymbol: string;
    baseExchangeRate?: number;
    roundingMode?: string;
    supportedCurrencies?: SupportedCurrencyItem[];
  }) => {
    return api.post<{ success: boolean; msg: string }>("/api/admin/update_currency_settings", payload);
  },

  getPlanPricesMatrix: () => {
    return api.get<{
      success: boolean;
      plans: AdminPlanItem[];
      prices: PlanPriceItem[];
      currencySettings: CurrencySettingsData;
      pppBenchmarks: Record<string, PppBenchmarkItem>;
      msg?: string;
    }>("/api/admin/plan_prices");
  },

  updatePlanPricesMatrix: (prices: PlanPriceItem[]) => {
    return api.post<{ success: boolean; msg: string }>("/api/admin/update_plan_prices", { prices });
  },

  suggestPppPrices: (usdPrice: number, strikeMultiplier: number = 2.5) => {
    return api.post<{
      success: boolean;
      suggestions: Record<
        string,
        {
          amount: number;
          strikeAmount: number | null;
          ratio: number;
          symbol: string;
          name: string;
          note: string;
        }
      >;
      msg?: string;
    }>("/api/admin/suggest_ppp_prices", { usdPrice, strikeMultiplier });
  },

  toggleUserStatus: (uid: string, is_blocked: boolean) => {
    return api.post<{ success: boolean; msg: string; is_blocked: number }>('/admin/toggle_user_status', {
      uid,
      is_blocked,
    });
  },

  updateUserPlan: (uid: string, plan: { id: number; title: string }) => {
    return api.post<{ success: boolean; msg: string }>('/admin/update_plan', {
      uid,
      plan,
    });
  },

  autoLoginAsUser: async (uid: string) => {
    const res = await fetch('/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    return (await res.json()) as { success: boolean; msg?: string };
  },

  deleteUser: (id: number) => {
    return api.post<{ success: boolean; msg: string }>('/admin/del_user', { id });
  },

  getWebPublic: () => {
    return api.get<{ success: boolean; data: any }>('/admin/get_web_public');
  },

  updateWebPublic: (payload: {
    app_name?: string;
    meta_description?: string;
    logo?: string;
    login_header_footer?: number;
  }) => {
    return api.post<{ success: boolean; msg: string }>('/admin/update_web_public', payload);
  },

  getFcmData: () => {
    return api.get<{ success: boolean; data: any }>('/admin/get_fcm_data');
  },

  updateFcmData: (payload: any) => {
    return api.post<{ success: boolean; msg: string }>('/admin/update_fcm_data', payload);
  },

  getSmtp: () => {
    return api.get<{ success: boolean; data: any }>('/admin/get_smtp');
  },

  updateSmtp: (payload: {
    host: string;
    port: number;
    username: string;
    password?: string;
    from_email?: string;
    email?: string;
    from_name?: string;
    secure?: boolean;
  }) => {
    const emailVal = payload.email || payload.from_email || '';
    return api.post<{ success: boolean; msg: string }>('/admin/update_smtp', {
      ...payload,
      email: emailVal,
      from_email: emailVal,
    });
  },

  sendTestEmail: (payload: {
    to_email?: string;
    to?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    from_email?: string;
    email?: string;
    from_name?: string;
    secure?: boolean;
  }) => {
    const toVal = payload.to || payload.to_email || '';
    const emailVal = payload.email || payload.from_email || '';
    return api.post<{ success: boolean; msg: string }>('/admin/send_test_email', {
      ...payload,
      to: toVal,
      to_email: toVal,
      email: emailVal,
      from_email: emailVal,
    });
  },

  getWorkspaces: (params?: { search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<{
      success: boolean;
      data: AdminWorkspaceItem[];
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/api/admin/get_workspaces${queryStr}`);
  },

  getAllInstances: (params?: { status?: string; type?: 'QR' | 'META' }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.type) q.append('type', params.type);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<{
      success: boolean;
      data: AdminWhatsAppInstanceItem[];
      summary: {
        total: number;
        qrCount: number;
        metaCount: number;
        activeCount: number;
        disconnectedCount: number;
      };
    }>(`/api/admin/get_all_instances${queryStr}`);
  },

  disconnectInstance: (payload: { uniqueId: string; type: 'QR' | 'META' }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/disconnect_instance', payload);
  },

  deleteInstance: (payload: { id?: number; uniqueId?: string; type: 'QR' | 'META' }) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/del_instance', payload);
  },

  getSubscriptions: () => {
    return api.get<{
      success: boolean;
      data: AdminSubscriptionItem[];
      summary: {
        total: number;
        active: number;
        expired: number;
        suspended: number;
      };
    }>('/api/admin/get_subscriptions');
  },

  getUsageSummary: () => {
    return api.get<{
      success: boolean;
      data: AdminUsageSummaryItem[];
      summary: {
        totalInspected: number;
        nearLimit: number;
        limitReached: number;
      };
    }>('/api/admin/get_usage_summary');
  },

  getAuditLogs: () => {
    return api.get<{
      success: boolean;
      data: Array<{
        id: number;
        admin_uid: string;
        action: string;
        target_type: string;
        target_id: string;
        details: any;
        ip_address: string | null;
        created_at: string;
      }>;
    }>('/api/admin/get_audit_logs');
  },

  getThemeConfig: () => {
    return api.get<{ success: boolean; data: any; msg?: string }>('/api/theme/get-theme-config');
  },

  updateThemeConfig: (themeData: any) => {
    return api.post<{ success: boolean; data: any; msg: string }>('/api/theme/update-theme-config', themeData);
  },

  updateBrandColors: (payload: {
    primary?: string;
    secondary?: string;
    accent?: string;
    success?: string;
    warning?: string;
    error?: string;
    info?: string;
  }) => {
    return api.post<{ success: boolean; data: any; msg: string }>('/api/theme/update-brand-colors', payload);
  },

  resetThemeConfig: () => {
    return api.post<{ success: boolean; data: any; msg: string }>('/api/theme/reset-to-default');
  },

  listThemes: () => {
    return api.get<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        description: string;
        isProtected: boolean;
        isActive: boolean;
      }>;
    }>('/api/theme/list-themes');
  },

  setActiveTheme: (themeId: string) => {
    return api.post<{ success: boolean; msg: string }>('/api/theme/set-active-theme', { themeId });
  },
};



