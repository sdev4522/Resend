export type AnalyticsRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsFilterParams {
  range?: AnalyticsRange;
  startDate?: string;
  endDate?: string;
  instanceId?: string;
}

export interface UserMessageTimeSeriesItem {
  date: string;
  incoming: number;
  outgoing: number;
  failed?: number;
  total: number;
}

export interface UserContactPhonebookItem {
  phonebook: string;
  count: number;
}

export interface UserRecentCampaignItem {
  id: number;
  campaign_id: string;
  title: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  createdAt: string;
}

export interface AvailableInstanceItem {
  id: string;
  title: string;
  number: string;
  status?: string;
  type: string;
}

export interface UserWorkspaceAnalytics {
  range: AnalyticsRange;
  startDate?: string;
  endDate?: string;
  selectedInstance?: {
    id?: string;
    type?: string;
    title: string;
    number?: string | null;
  } | null;
  availableInstances: AvailableInstanceItem[];
  messages: {
    total: number;
    incoming: number;
    outgoing: number;
    delivered: number;
    read: number;
    failed: number;
    timeSeries: UserMessageTimeSeriesItem[];
  };
  conversations: {
    total: number;
    activeInPeriod: number;
    totalUnread: number;
    byOrigin: Array<{ origin: string; count: number }>;
  };
  contacts: {
    total: number;
    newInPeriod: number;
    byPhonebook: UserContactPhonebookItem[];
  };
  whatsapp: {
    total: number;
    qr: number;
    meta: number;
    active: number;
    disconnected: number;
  };
  campaigns: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    recent: UserRecentCampaignItem[];
  };
  automations: {
    totalFlows: number;
    totalChatbots: number;
    activeChatbots: number;
    inactiveChatbots: number;
  };
  usage: {
    contacts: {
      used: number;
      limit: number;
      remaining: number;
    };
    qrAccounts: {
      used: number;
      limit: number;
      remaining: number;
    };
    chatbot: {
      allowed: boolean;
      activeCount: number;
    };
    planTitle: string;
    planExpire: string | null;
  };
}

export interface AdminUserGrowthItem {
  date: string;
  count: number;
}

export interface AdminPlanDistributionItem {
  planTitle: string;
  count: number;
}

export interface AdminRevenueTimeSeriesItem {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface AdminPlatformAnalytics {
  range: AnalyticsRange;
  startDate?: string;
  endDate?: string;
  users: {
    total: number;
    active: number;
    blocked: number;
    newInPeriod: number;
    growthTimeSeries: AdminUserGrowthItem[];
    planDistribution: AdminPlanDistributionItem[];
  };
  revenue: {
    totalRevenue: number;
    periodRevenue: number;
    totalOrders: number;
    successfulOrders: number;
    pendingOrders: number;
    failedOrders: number;
    timeSeries: AdminRevenueTimeSeriesItem[];
  };
  whatsapp: {
    total: number;
    qr: number;
    meta: number;
    active: number;
    disconnected: number;
  };
  throughput: {
    messagesInPeriod: number;
    incomingInPeriod: number;
    outgoingInPeriod: number;
    deliveredInPeriod: number;
    readInPeriod: number;
    failedInPeriod: number;
    campaignsInPeriod: number;
    campaignDispatches: number;
    campaignDelivered: number;
    campaignRead: number;
    campaignFailed: number;
    totalFlows: number;
    activeChatbots: number;
    timeSeries: Array<{
      date: string;
      incoming: number;
      outgoing: number;
      failed: number;
      total: number;
    }>;
  };
  topWorkspaces?: Array<{
    uid: string;
    name: string;
    email: string;
    contactCount: number;
  }>;
  auditLogs?: Array<{
    id: number;
    admin_uid: string;
    action: string;
    target_type: string;
    target_id: string;
    details: any;
    ip_address: string | null;
    created_at: string;
  }>;
}

export interface AdminUserDetails {
  user: {
    id: number;
    uid: string;
    name: string;
    email: string;
    role?: string;
    mobile_with_country_code: string;
    timezone: string;
    plan: string;
    plan_expire: string | null;
    trial: number;
    createdAt: string;
    subscription_id: string | null;
    subscription_status: string | null;
    is_blocked: number;
    parsedPlan?: any;
  };
  stats: {
    instancesCount: number;
    contactsCount: number;
    campaignsCount: number;
    flowsCount: number;
    chatbotsCount: number;
    ordersCount: number;
  };
  instances: Array<{
    id: number;
    title: string;
    number: string;
    uniqueId: string;
    status: string;
    createdAt: string;
  }>;
  recentCampaigns: Array<{
    id: number;
    campaign_id: string;
    title: string;
    status: string;
    total_contacts: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
    createdAt: string;
  }>;
  recentFlows: Array<{
    id: number;
    flow_id: string;
    name: string;
    source: string;
    createdAt: string;
  }>;
  chatbots: Array<{
    id: number;
    title: string;
    active: number;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: number;
    amount: string;
    status: string;
    payment_mode: string;
    createdAt: string;
  }>;
}
