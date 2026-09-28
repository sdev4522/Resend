'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Cookie, X } from 'lucide-react';
import { setAnalyticsConsent, hasAnalyticsConsent } from '@/lib/analytics/tracker';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wacrm_cookie_consent');
      if (!stored) {
        // Show after a brief non-intrusive delay
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage unavailable
    }

    const handleReopen = () => setVisible(true);
    window.addEventListener('wacrm_open_cookie_banner', handleReopen);
    return () => window.removeEventListener('wacrm_open_cookie_banner', handleReopen);
  }, []);

  const handleAcceptAll = () => {
    setAnalyticsConsent('accepted');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setAnalyticsConsent('essential');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie and Privacy Preferences"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="rounded-2xl border bg-background/95 p-5 shadow-xl backdrop-blur-md dark:bg-card/95">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Cookie &amp; Privacy Preferences
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              We use essential cookies to keep you signed in securely and optional performance metrics to improve the platform. We never sell your personal data.
            </p>
          </div>
          <button
            onClick={handleEssentialOnly}
            aria-label="Dismiss cookie notice"
            className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2 pt-2 border-t text-xs">
          <Link
            href="/privacy#cookies"
            className="text-muted-foreground hover:text-foreground underline underline-offset-4 mr-auto"
          >
            Privacy Policy
          </Link>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEssentialOnly}
              className="text-xs h-8 px-3 rounded-full flex-1 sm:flex-none"
            >
              Essential Only
            </Button>
            <Button
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs h-8 px-4 rounded-full flex-1 sm:flex-none"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
