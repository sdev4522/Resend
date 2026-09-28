'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserNav } from '@/components/shared/user-nav';
import { NotificationsPopover } from './notifications-popover';
import { CurrencySwitcher } from './currency-switcher';
import { getPlanTitle } from '@/lib/utils';
import { Smartphone } from 'lucide-react';
import { siteConfig } from '@/config/site';

export function DashboardHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Find matching nav item
  const activeNavItem = siteConfig.dashboardNav.find((item) =>
    item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
  );

  const isHomeDashboard = pathname === '/dashboard';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b bg-background/95 px-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Official shadcn Sidebar Trigger with comfortable touch target */}
        <SidebarTrigger className="h-9 w-9 cursor-pointer touch-manipulation" aria-label="Toggle navigation sidebar" />
        <Separator orientation="vertical" className="h-4 hidden sm:block" />

        {/* Dynamic Breadcrumbs */}
        <Breadcrumb className="hidden sm:block truncate">
          <BreadcrumbList>
            <BreadcrumbItem>
              {isHomeDashboard ? (
                <BreadcrumbPage className="font-semibold text-xs sm:text-sm">
                  Dashboard
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="/dashboard" className="text-xs sm:text-sm">
                  Dashboard
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!isHomeDashboard && activeNavItem && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-xs sm:text-sm">
                    {activeNavItem.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* WhatsApp Connection Real Status Pill (compact on small screens) */}
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-xs">
          <span className="relative flex h-2 w-2">
            {user?.wa_connected ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
            )}
          </span>
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground hidden sm:inline-block">
            {user?.wa_connected
              ? user?.wa_phone ? `WA: ${user.wa_phone}` : 'Connected'
              : 'WA Offline'}
          </span>
          {!user?.wa_connected && (
            <Link
              href="/dashboard/integrations"
              className="text-primary hover:underline ml-0.5 text-[11px] font-semibold"
            >
              Connect
            </Link>
          )}
        </div>

        {/* Plan Badge on Desktop */}
        {user?.plan && (
          <Badge
            variant="outline"
            className="hidden md:inline-flex text-[11px] font-medium h-6"
          >
            {getPlanTitle(user.plan)}
          </Badge>
        )}

        {/* Currency Switcher Dropdown (hidden on small mobile to prevent header overflow) */}
        <div className="hidden sm:block">
          <CurrencySwitcher />
        </div>

        {/* Notifications Popover */}
        <NotificationsPopover />

        {/* Theme Switcher */}
        <ThemeToggle />

        {/* User Account Navigation */}
        <UserNav />
      </div>
    </header>
  );
}
