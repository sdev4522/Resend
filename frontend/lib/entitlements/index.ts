import { User } from '@/types/user';

export interface PlanLimits {
  contacts: number;
  campaigns: number;
  templates: number;
  flows: number;
  chatbots: number;
  agents: number;
}

export const DEFAULT_FREE_LIMITS: PlanLimits = {
  contacts: 50,
  campaigns: 2,
  templates: 5,
  flows: 1,
  chatbots: 2,
  agents: 0,
};

export function getUserLimits(user: User | null): PlanLimits {
  if (!user || !user.plan) {
    return DEFAULT_FREE_LIMITS;
  }

  const p = user.plan;
  return {
    contacts: p.contact_limit ?? DEFAULT_FREE_LIMITS.contacts,
    campaigns: p.campaign_limit ?? DEFAULT_FREE_LIMITS.campaigns,
    templates: p.template_limit ?? DEFAULT_FREE_LIMITS.templates,
    flows: p.flow_limit ?? DEFAULT_FREE_LIMITS.flows,
    chatbots: p.chatbot_limit ?? DEFAULT_FREE_LIMITS.chatbots,
    agents: p.agent_limit ?? DEFAULT_FREE_LIMITS.agents,
  };
}

export function canAccessFeature(user: User | null, feature: keyof PlanLimits, currentUsage = 0): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const limits = getUserLimits(user);
  return currentUsage < limits[feature];
}

export function isPlanExpired(user: User | null): boolean {
  if (!user || !user.plan_expiration) return false;
  const expiry = new Date(user.plan_expiration).getTime();
  return expiry < Date.now();
}
