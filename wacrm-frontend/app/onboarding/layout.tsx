import React from 'react';
import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-8 pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">WaCRM Setup</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 pb-safe">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Need assistance with setup? Contact our support team.
      </footer>
    </div>
  );
}
