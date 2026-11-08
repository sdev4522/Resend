'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { canAccessRoute } from '@/lib/auth/permissions';
import { siteConfig } from '@/config/site';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from './workspace-switcher';
import { ResendMark } from '@/components/marketing/landing/landing-nav';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  FileText,
  Bot,
  GitFork,
  BarChart3,
  Plug,
  UserCheck,
  CreditCard,
  Settings,
  Code2,
  LifeBuoy,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  FileText,
  Bot,
  GitFork,
  BarChart3,
  Plug,
  UserCheck,
  CreditCard,
  Code2,
  LifeBuoy,
  Settings,
};

/** Sidebar sections, by route. Anything not listed falls into the last group. */
const GROUPS: { label: string; hrefs: string[] }[] = [
  { label: 'Messaging', hrefs: ['/dashboard', '/dashboard/inbox', '/dashboard/contacts', '/dashboard/campaigns', '/dashboard/templates'] },
  { label: 'Automation', hrefs: ['/dashboard/automation', '/dashboard/flows', '/dashboard/analytics'] },
  { label: 'Workspace', hrefs: [] },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-3 gap-3">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <ResendMark className="h-8 w-8 shrink-0 text-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Resend
          </span>
        </div>

        {/* Workspace Switcher */}
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {GROUPS.map((group, gi) => {
          const items = siteConfig.dashboardNav.filter((item) => {
            if (item.href === '/dashboard/support' || !canAccessRoute(role, item.href)) return false;
            const listed = GROUPS.some((g) => g.hrefs.includes(item.href));
            return gi === GROUPS.length - 1 ? !listed || group.hrefs.includes(item.href) : group.hrefs.includes(item.href);
          });
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {items.map((item) => {
                    const Icon = iconMap[item.icon] || LayoutDashboard;
                    const isActive =
                      pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} onClick={handleNavClick} />}
                          isActive={isActive}
                          tooltip={item.title}
                          className={`relative h-9 cursor-pointer rounded-lg font-medium transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary data-[active]:bg-primary/10 data-[active]:text-primary'
                              : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                          }`}
                        >
                          {isActive && (
                            <span aria-hidden="true" className="absolute -left-2 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                          )}
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        {item.badge && (
                          <SidebarMenuBadge className="gap-1 text-[10px] font-semibold text-primary group-data-[collapsible=icon]:hidden">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Bottom-pinned: Help & Support widget */}
      <SidebarFooter className="px-2 pb-3 pt-1">
        {/* Collapsed (icon-only) mode */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center">
          <Link
            href="/dashboard/support"
            onClick={handleNavClick}
            title="Help & Support"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-primary/10 hover:text-primary ${pathname.startsWith('/dashboard/support')
              ? 'bg-primary/10 text-primary'
              : 'text-sidebar-foreground/70'
              }`}
          >
            <LifeBuoy className="h-4 w-4" />
          </Link>
        </div>

        {/* Expanded mode — card widget */}
        <Link
          href="/dashboard/support"
          onClick={handleNavClick}
          className={`group-data-[collapsible=icon]:hidden flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all hover:shadow-xs ${pathname.startsWith('/dashboard/support')
            ? 'border-primary/30 bg-primary/8 text-primary'
            : 'border-border bg-sidebar-accent/40 text-sidebar-foreground hover:border-primary/20 hover:bg-primary/5'
            }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pathname.startsWith('/dashboard/support')
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
            }`}>
            <LifeBuoy className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight">Help &amp; Support</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">Tickets &amp; resources</p>
          </div>
        </Link>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
