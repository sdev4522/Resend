import { UserRole } from '@/types/user';

/**
 * Centralized authorization helper for dashboard navigation and capabilities.
 */
export function canAccessRoute(role: UserRole | null | undefined, href: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'user') return true;

  // Agent role restrictions
  if (role === 'agent') {
    // Agents have operational access: Dashboard, Inbox, Contacts (lookup), Settings (own profile)
    const agentAllowedPrefixes = [
      '/dashboard',
      '/dashboard/inbox',
      '/dashboard/contacts',
      '/dashboard/settings',
    ];
    // Block administrative and billing routes for agents
    const agentBlockedRoutes = [
      '/dashboard/billing',
      '/dashboard/team',
      '/dashboard/integrations',
      '/dashboard/support',
    ];

    if (agentBlockedRoutes.some((b) => href === b || href.startsWith(`${b}/`))) {
      return false;
    }

    return agentAllowedPrefixes.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));
  }

  return false;
}
