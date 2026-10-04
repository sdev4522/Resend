import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquareQuote } from 'lucide-react';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-center items-center p-4 sm:p-6 pt-safe pb-safe bg-muted/20">
      {/* Top bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 pt-safe pr-safe">
        <ThemeToggle />
      </div>

      {/* Brand logo link */}
      <div className="mb-8 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MessageSquareQuote className="h-5 w-5" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground">Resend</span>
        </Link>
      </div>

      {/* Auth Card Container */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Resend Inc. All rights reserved.
      </div>
    </div>
  );
}
