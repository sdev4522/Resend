export { cn } from "cn";

export function getPlanTitle(plan: any): string {
  if (!plan) return 'Free Trial';
  if (typeof plan === 'object' && plan?.title) return String(plan.title);
  if (typeof plan === 'string') {
    try {
      const parsed = JSON.parse(plan);
      if (parsed && typeof parsed === 'object' && parsed.title) {
        return String(parsed.title);
      }
    } catch {
      // not json
    }
    if (!plan.trim().startsWith('{')) {
      return plan;
    }
  }
  return 'Active Plan';
}

export function parseUserPlan(plan: any): any {
  if (!plan) return null;
  if (typeof plan === 'object') return plan;
  if (typeof plan === 'string') {
    try {
      return JSON.parse(plan);
    } catch {
      return null;
    }
  }
  return null;
}
