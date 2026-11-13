'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight, Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * One source of truth for "is this workspace's plan usable?" across the dashboard.
 * The backend still enforces it (checkPlan → 403 PLAN_EXPIRED / NO_PLAN); this layer
 * stops users before they start a flow that can only fail, and explains why.
 */

type PlanState = 'loading' | 'active' | 'expired' | 'none';

interface PlanStatusValue {
  state: PlanState;
  /** True when actions that need a plan must be blocked. */
  isInactive: boolean;
  planTitle: string | null;
  expiredOn: Date | null;
  refresh: () => Promise<void>;
  /** Opens the upgrade popup; `action` names what the user tried to do. */
  openUpgrade: (action?: string) => void;
  /** Returns true if allowed; otherwise opens the popup and returns false. */
  requireActivePlan: (action?: string) => boolean;
}

const PlanStatusContext = createContext<PlanStatusValue | null>(null);

const SESSION_KEY = 'resend:plan-expired-popup-shown';

/** Backend plan errors (checkPlan middleware) carry one of these codes. */
export function isPlanError(err: unknown): boolean {
  const code = (err as { data?: { code?: string } })?.data?.code;
  return code === 'PLAN_EXPIRED' || code === 'NO_PLAN';
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export function PlanStatusProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, isExpired, plan, refresh } = useEntitlements();
  const { user } = useAuth();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<{ open: boolean; action?: string }>({ open: false });

  const state: PlanState = loading && !data
    ? 'loading'
    : !data
      ? 'active' // couldn't load: don't block on a network blip, the backend still enforces
      : isExpired
        ? 'expired'
        : data.isValid === false
          ? 'none'
          : 'active';
  const isInactive = state === 'expired' || state === 'none';

  const expiredOn = useMemo(() => {
    const raw = data?.plan_expire;
    if (!raw) return null;
    const d = new Date(/^\d+$/.test(String(raw)) ? Number(raw) : raw);
    return isNaN(d.getTime()) ? null : d;
  }, [data?.plan_expire]);

  const openUpgrade = useCallback((action?: string) => setDialog({ open: true, action }), []);
  const requireActivePlan = useCallback(
    (action?: string) => {
      if (!isInactive) return true;
      openUpgrade(action);
      return false;
    },
    [isInactive, openUpgrade]
  );

  // Tell the user once per browser session, not on every page
  useEffect(() => {
    if (!isInactive || pathname?.startsWith('/dashboard/billing')) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* storage unavailable: still show it */
    }
    setDialog({ open: true });
  }, [isInactive, pathname]);

  const value = useMemo<PlanStatusValue>(
    () => ({
      state,
      isInactive,
      planTitle: plan?.title ?? null,
      expiredOn,
      refresh,
      openUpgrade,
      requireActivePlan,
    }),
    [state, isInactive, plan?.title, expiredOn, refresh, openUpgrade, requireActivePlan]
  );

  const isOwner = !user?.role || user.role === 'user';
  const title = state === 'none' ? 'Choose a plan to continue' : 'Your plan has expired';
  const body =
    state === 'none'
      ? 'This workspace has no active plan.'
      : `${plan?.title ? `Your ${plan.title} plan` : 'Your plan'} ended${expiredOn ? ` on ${fmt(expiredOn)}` : ''}.`;

  return (
    <PlanStatusContext.Provider value={value}>
      {children}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-[420px]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-warning/12 text-warning">
            <Lock className="size-5" />
          </div>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {dialog.action ? `To ${dialog.action}, renew your plan. ` : ''}
              {body}{' '}
              {isOwner
                ? 'Connecting numbers, sending messages, campaigns and automations are paused until you renew. Your contacts and chats are safe.'
                : 'Ask the workspace owner to renew it. Your contacts and chats are safe.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog({ open: false })}>
              Not now
            </Button>
            {isOwner && (
              <Button render={<Link href="/dashboard/billing" />} onClick={() => setDialog({ open: false })}>
                {state === 'none' ? 'See plans' : 'Renew plan'}
                <ArrowRight />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlanStatusContext.Provider>
  );
}

export function usePlanStatus(): PlanStatusValue {
  const ctx = useContext(PlanStatusContext);
  if (!ctx) {
    // Outside the dashboard: never block
    return {
      state: 'active',
      isInactive: false,
      planTitle: null,
      expiredOn: null,
      refresh: async () => {},
      openUpgrade: () => {},
      requireActivePlan: () => true,
    };
  }
  return ctx;
}

/** Persistent strip under the header while the plan is inactive. */
export function PlanExpiredBanner() {
  const { isInactive, state, planTitle, expiredOn } = usePlanStatus();
  const { user } = useAuth();
  const pathname = usePathname();
  if (!isInactive || pathname?.startsWith('/dashboard/billing')) return null;
  const isOwner = !user?.role || user.role === 'user';

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-warning/25 bg-warning/8 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p className="flex items-start gap-2 text-foreground sm:items-center">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0" />
        <span>
          <span className="font-semibold">
            {state === 'none' ? 'No active plan.' : `${planTitle ? `${planTitle} plan` : 'Plan'} expired${expiredOn ? ` on ${fmt(expiredOn)}` : ''}.`}
          </span>{' '}
          <span className="text-muted-foreground">
            Messaging, campaigns and new connections are paused.
          </span>
        </span>
      </p>
      {isOwner ? (
        <Button size="sm" render={<Link href="/dashboard/billing" />} className="self-start sm:self-auto">
          {state === 'none' ? 'See plans' : 'Renew plan'}
          <ArrowRight />
        </Button>
      ) : (
        <span className="text-[13px] text-muted-foreground">Ask the workspace owner to renew.</span>
      )}
    </div>
  );
}
