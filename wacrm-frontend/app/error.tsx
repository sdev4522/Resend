'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error message without leaking secrets
    console.error('Application runtime error:', error?.message || 'Unknown error');
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 bg-background text-foreground text-center">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border bg-card shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          System Notice
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          An unexpected error occurred while processing your request. Please try reloading the page or return to the homepage.
        </p>

        {error?.digest && (
          <p className="mt-2 text-[11px] font-mono text-muted-foreground/60">
            Incident ID: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            size="lg"
            className="w-full sm:w-auto rounded-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>

          <Button
            render={<Link href="/" />}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-full"
          >
            <Home className="mr-2 h-4 w-4" /> Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}
