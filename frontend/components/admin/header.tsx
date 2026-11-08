'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserNav } from '@/components/shared/user-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu, ChevronRight, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebar } from './sidebar';

const routeBreadcrumbMap: Record<string, { section: string; title: string }> = {
  '/admin': { section: 'Overview', title: 'Dashboard' },
  '/admin/analytics': { section: 'Overview', title: 'Platform Analytics' },
  '/admin/users': { section: 'Tenants & Users', title: 'User Management' },
  '/admin/workspaces': { section: 'Tenants & Users', title: 'Workspaces' },
  '/admin/support': { section: 'Tenants & Users', title: 'Customer Support' },
  '/admin/whatsapp': { section: 'Fleet & Compute', title: 'WhatsApp Fleet' },
  '/admin/usage': { section: 'Fleet & Compute', title: 'Usage & Quotas' },
  '/admin/plans': { section: 'Plans & Billing', title: 'Subscription Plans' },
  '/admin/subscriptions': { section: 'Plans & Billing', title: 'Active Subscriptions' },
  '/admin/payments': { section: 'Plans & Billing', title: 'Payment Logs' },
  '/admin/settings': { section: 'System & Security', title: 'System Settings' },
  '/admin/notifications': { section: 'System & Security', title: 'Notification Center' },
  '/admin/mail': { section: 'System & Security', title: 'Mail Templates' },
  '/admin/audit': { section: 'System & Security', title: 'Audit & Activity Logs' },
  '/admin/profile': { section: 'Account', title: 'Admin Profile' },
};

export function AdminHeader() {
  const pathname = usePathname();

  const currentInfo =
    routeBreadcrumbMap[pathname] ||
    (pathname.startsWith('/admin/users/')
      ? { section: 'Tenants & Users', title: 'User Details' }
      : { section: 'Admin Console', title: 'Control Panel' });

  return (
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 w-full items-center justify-between border-b bg-background/95 px-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 select-none">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Mobile menu trigger */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 lg:hidden touch-manipulation"
              />
            }
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <AdminSidebar isMobile />
          </SheetContent>
        </Sheet>

        {/* Dynamic Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Link
            href="/admin"
            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Admin</span>
          </Link>

          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />

          <span className="hidden md:inline font-medium text-muted-foreground/80 truncate">
            {currentInfo.section}
          </span>

          <ChevronRight className="h-3 w-3 text-muted-foreground/60 hidden md:inline shrink-0" />

          <span className="font-semibold text-foreground truncate">
            {currentInfo.title}
          </span>
        </nav>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 border-primary/20 bg-primary/5 text-primary"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span>ADMIN ACCESS</span>
        </Badge>

        <ThemeToggle />
        <UserNav forceMode="admin" />
      </div>
    </header>
  );
}
