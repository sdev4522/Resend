'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';
import {
  ShieldAlert,
  Users,
  Package,
  Receipt,
  Server,
  Sliders,
  BarChart3,
  Bell,
  Mail,
  Building2,
  CreditCard,
  Gauge,
  History,
  LifeBuoy,
  LucideIcon,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

const adminIconMap: Record<string, LucideIcon> = {
  ShieldAlert,
  Users,
  Package,
  Receipt,
  Server,
  Sliders,
  BarChart3,
  Bell,
  Mail,
  Building2,
  CreditCard,
  Gauge,
  History,
  LifeBuoy,
};

interface AdminSidebarProps {
  isMobile?: boolean;
}

export function AdminSidebar({ isMobile = false }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border select-none",
        isMobile ? "w-full" : "w-64"
      )}
    >
      {/* Brand header */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-sidebar-foreground">WaCRM Admin</span>
          <span className="text-[10px] uppercase font-semibold text-red-500 tracking-wider">
            Super Administrator
          </span>
        </div>
      </div>

      {/* Admin Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Control Panel
        </div>
        {siteConfig.adminNav.map((item) => {
          const Icon = adminIconMap[item.icon] || ShieldAlert;
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-red-500" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.title}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Back to User Dashboard */}
      <div className="p-4 border-t border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Admin to App</span>
        </Link>
      </div>
    </aside>
  );
}
