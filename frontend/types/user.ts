export type UserRole = 'user' | 'agent' | 'admin';

export interface UserPlan {
  id: number;
  title: string;
  price: number;
  contact_limit: number;
  campaign_limit: number;
  template_limit: number;
  flow_limit: number;
  chatbot_limit: number;
  agent_limit: number;
  is_trial?: boolean;
}

export interface User {
  id: number;
  uid: string;
  name: string;
  email: string;
  email_verified?: boolean;
  email_verified_at?: string | null;
  role: UserRole;
  phone?: string;
  mobile?: string;
  mobile_with_country_code?: string;
  avatar?: string;
  timezone?: string;
  contact?: number;
  plan_id?: number;
  plan_name?: string;
  plan_expiration?: string | null;
  plan_expire?: string | null;
  plan?: UserPlan;
  wa_connected?: boolean;
  wa_phone?: string;
  wa_name?: string;
  api_key?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Agent {
  id: number;
  uid: string;
  user_id: number;
  name: string;
  email: string;
  role: 'agent';
  permissions?: string[];
  status: 'active' | 'inactive';
  created_at?: string;
}
