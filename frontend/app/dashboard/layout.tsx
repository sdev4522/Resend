import React from 'react';
import type { Metadata } from 'next';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';

export const metadata: Metadata = {
  title: {
    default: 'Resend Dashboard',
    template: '%s | Resend',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="min-w-0 flex flex-col h-[100dvh] overflow-hidden bg-background">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-safe">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
