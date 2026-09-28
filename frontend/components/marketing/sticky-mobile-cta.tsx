'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, X } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { useAuth } from '@/lib/auth/auth-context';

export function StickyMobileCTA() {
  const [dismissed, setDismissed] = useState(false);
  const { openRegister } = useAuthDialog();
  const { isAuthenticated } = useAuth();

  if (dismissed || isAuthenticated) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Quick Action Banner"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t px-4 py-2.5 pb-safe flex items-center justify-between gap-3 shadow-lg"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate text-foreground">
          Scale on WhatsApp
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          Official Cloud API &amp; Multi-Agent Inbox
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={openRegister}
          className="rounded-full h-8 px-3.5 text-xs font-medium cursor-pointer"
        >
          Get Started <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
        </Button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss quick banner"
          className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
