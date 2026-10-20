'use client';

import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function MarketingCTABanner() {
  const { openRegister, openLogin } = useAuthDialog();

  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/30 p-8 sm:p-14 lg:p-16 text-center shadow-xl">
        {/* Subtle decorative radial background */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(0,168,132,0.12),transparent)]" />

        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Start Managing WhatsApp Customer Conversations More Effectively
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Consolidate team inboxes, verified template broadcasts, and automated replies in one workspace. Start your 14-day free trial in under 5 minutes.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={openRegister}
              variant="default"
              size="lg"
              className="h-12 px-8 text-base rounded-full font-semibold text-white shadow-lg shadow-primary/20 cursor-pointer w-full sm:w-auto"
            >
              <span className="flex items-center gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={openLogin}
              className="h-12 rounded-full px-7 text-base font-medium cursor-pointer w-full sm:w-auto hover:bg-muted"
            >
              Sign In
            </Button>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground border-t border-border/50 mt-8">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>14-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Official Cloud API &amp; QR Support</span>
            </div>
          </div>
        </div>

        {/* Magic UI BorderBeam Animated Border */}
      </div>
    </section>
  );
}
