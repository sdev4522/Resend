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
  MessageSquareQuote,
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <MessageSquareQuote className="h-4 w-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Resend
          </span>
        </div>

        {/* Workspace Switcher */}
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {siteConfig.dashboardNav.filter((item) => item.href !== '/dashboard/support').map((item) => {
                if (!canAccessRoute(role, item.href)) {
                  return null;
                }

                const Icon = iconMap[item.icon] || LayoutDashboard;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={item.href}
                          onClick={handleNavClick}
                          className={`${isActive
                            ? 'border border-primary/30 bg-primary/8 text-primary'
                            : 'font-medium text-smss'
                            }`}
                        />
                      }
                      isActive={isActive}
                      tooltip={item.title}
                      // className="cursor-pointer font-medium text-sm transition-colors"
                      className={`cursor-pointer ${isActive
                        ? 'border border-primary/30 bg-primary/8 text-primary'
                        : 'font-medium text-sms'
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="text-[10px] bg-primary/10 text-primary font-semibold group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
