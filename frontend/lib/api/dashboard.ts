import { api } from './client';

export interface DashboardStats {
  agents: number;
  activeChats: number;
  completedTasks: number;
  activeInstances: number;
}

export interface DashboardData {
  user: {
    uid: string;
    name: string;
    email: string;
    mobile_with_country_code?: string;
    timezone?: string;
    plan?: any;
    plan_expire?: string;
    contact?: number;
    wa_connected?: boolean;
    wa_phone?: string;
  };
  stats: DashboardStats;
  recentConversations: any[];
  unreadSummary: any[];
  activeChatbots: { title: string; flow_id: string }[];
  performanceData: { date: string; incoming: number; outgoing: number }[];
  lastUpdated: string;
}

export interface QrInstance {
  id?: number;
  uniqueId: string;
  name: string;
  status: string;
  phone?: string;
  createdAt?: string;
}

export interface MetaApiKeys {
  id?: number;
  uid?: string;
  waba_id?: string;
  phone_number_id?: string;
  token?: string;
}

export interface AgentMember {
  id: number;
  uid: string;
  owner_uid: string;
  name: string;
  email: string;
  mobile: string;
  comments?: string;
  activeness?: number;
  mask_number?: number;
  createdAt?: string;
}

export interface AddAgentPayload {
  name: string;
  email: string;
  password: string;
  mobile: string;
  comments?: string;
}

export interface UpdateProfilePayload {
  name: string;
  email: string;
  mobile_with_country_code: string;
  timezone: string;
  newPassword?: string;
}

export const dashboardApi = {
  getDashboard: () => {
    return api.get<{ success: boolean; data: DashboardData }>('/api/proxy/api/user/get_dashboard');
  },

  getQrInstances: () => {
    return api.get<{ success: boolean; data: QrInstance[] }>('/api/proxy/api/qr/get_all');
  },

  getMetaKeys: () => {
    return api.get<{ success: boolean; data: MetaApiKeys }>('/api/proxy/api/user/get_meta_keys');
  },
};

export const teamApi = {
  getAgents: () => {
    return api.get<{ success: boolean; data: AgentMember[] }>('/api/proxy/api/agent/get_my_agents');
  },

  addAgent: (payload: AddAgentPayload) => {
    return api.post<{ success: boolean; msg?: string }>('/api/proxy/api/agent/add_agent', payload);
  },

  deleteAgent: (agentUid: string) => {
    return api.post<{ success: boolean; msg?: string }>('/api/proxy/api/agent/del_agent', { agentUid });
  },

  toggleAgent: (agentUid: string, activeness: boolean) => {
    return api.post<{ success: boolean; msg?: string }>('/api/proxy/api/agent/change_status_mask', {
      agentUid,
      activeness,
    });
  },
};

export const userApi = {
  updateProfile: (payload: UpdateProfilePayload) => {
    return api.post<{ success: boolean; msg?: string }>('/api/proxy/api/user/update_profile', payload);
  },
};
