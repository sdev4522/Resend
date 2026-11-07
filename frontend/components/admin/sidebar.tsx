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
  LayoutDashboard,
  Smartphone,
  Shield,
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
  ShieldCheck,
  LayoutDashboard,
  Smartphone,
  Shield,
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
      <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground truncate">
              Resend Admin
            </span>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider truncate">
              Control Console
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-muted/60 text-muted-foreground border border-border/40">
          v2.4
        </span>
      </div>

      {/* Admin Navigation — Grouped Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {siteConfig.adminNavSections.map((section, sIdx) => (
          <div key={section.title || sIdx} className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = adminIconMap[item.icon] || ShieldAlert;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/15 font-semibold shadow-2xs"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-sidebar-foreground"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer & Exit Link */}
      <div className="p-3 border-t border-sidebar-border space-y-2 bg-sidebar/50">
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground rounded-md bg-muted/40 border border-border/40">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-foreground">Cluster Active</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">Prod</span>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
          <span>Exit Admin to App</span>
        </Link>
      </div>
    </aside>
  );
}
