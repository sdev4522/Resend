'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight, Check, Gift, Lock, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useAuth } from '@/lib/auth/auth-context';
import { billingApi } from '@/lib/api/billing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * One source of truth for "can this workspace use paid features?" across the dashboard.
 * The backend still enforces it (checkPlan → 403 PLAN_EXPIRED / NO_PLAN / FEATURE_NOT_INCLUDED /
 * PLAN_LIMIT_REACHED); this layer stops users before a flow that can only fail, explains why,
 * and lets new workspaces claim their free trial.
 */

type PlanState = 'loading' | 'active' | 'trial_available' | 'expired' | 'none';
type DialogKind = 'blocked' | 'feature' | 'limit' | 'claimed';

interface PlanStatusValue {
  state: PlanState;
  /** True when actions that need a plan must be blocked. */
  isInactive: boolean;
  planTitle: string | null;
  expiredOn: Date | null;
  trialDays: number;
  isClaiming: boolean;
  refresh: () => Promise<void>;
  claimTrial: () => Promise<void>;
  /** Opens the upgrade/claim popup; `action` names what the user tried to do. */
  openUpgrade: (action?: string) => void;
  /** Returns true if allowed; otherwise opens the popup and returns false. */
  requireActivePlan: (action?: string) => boolean;
}

const PlanStatusContext = createContext<PlanStatusValue | null>(null);

const SESSION_KEY = 'resend:plan-popup-shown';

/** Backend plan errors carry one of these codes (see lib/api/client.ts). */
export function isPlanError(err: unknown): boolean {
  const code = (err as { data?: { code?: string } })?.data?.code;
  return code === 'PLAN_EXPIRED' || code === 'NO_PLAN';
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

export function PlanStatusProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, isExpired, plan, refresh } = useEntitlements();
  const { user, refreshUser } = useAuth();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<{ open: boolean; kind: DialogKind; action?: string; msg?: string }>({
    open: false,
    kind: 'blocked',
  });
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedUntil, setClaimedUntil] = useState<Date | null>(null);
  // Focus the popup body on open so no button looks pre-selected
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const trialAvailable = Boolean(data?.trial?.available);
  const trialDays = data?.trial?.days || 14;

  const state: PlanState =
    loading && !data
      ? 'loading'
      : !data
        ? 'active' // couldn't load: don't block on a network blip, the backend still enforces
        : data.isValid
          ? 'active'
          : isExpired
            ? 'expired'
            : trialAvailable
              ? 'trial_available'
              : 'none';
  const isInactive = state === 'expired' || state === 'none' || state === 'trial_available';
  const isOwner = !user?.role || user.role === 'user';

  const expiredOn = useMemo(() => {
    const raw = data?.plan_expire;
    if (!raw) return null;
    const d = new Date(/^\d+$/.test(String(raw)) ? Number(raw) : raw);
    return isNaN(d.getTime()) ? null : d;
  }, [data?.plan_expire]);

  const openUpgrade = useCallback(
    (action?: string) => setDialog({ open: true, kind: 'blocked', action }),
    []
  );
  const requireActivePlan = useCallback(
    (action?: string) => {
      if (!isInactive) return true;
      openUpgrade(action);
      return false;
    },
    [isInactive, openUpgrade]
  );

  const claimTrial = useCallback(async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    try {
      const res = await billingApi.activateTrial();
      if (!res?.success) throw new Error(res?.msg || 'Could not start your free trial.');
      await refreshUser();
      // Refreshes this provider and every other useEntitlements() on the page
      window.dispatchEvent(new CustomEvent('wacrm:plan-changed'));
      setClaimedUntil(res.newExpiry ? new Date(Number(res.newExpiry)) : null);
      setDialog({ open: true, kind: 'claimed' });
    } catch (err) {
      toast.error((err as Error)?.message || 'Could not start your free trial.');
      await refresh();
    } finally {
      setIsClaiming(false);
    }
  }, [isClaiming, refresh, refreshUser]);

  // Any request rejected for plan reasons (from any page) opens the right popup
  useEffect(() => {
    const onPlanRequired = (e: Event) => {
      const { code, msg } = (e as CustomEvent<{ code: string; msg?: string }>).detail || {};
      if (code === 'FEATURE_NOT_INCLUDED') setDialog({ open: true, kind: 'feature', msg });
      else if (code === 'PLAN_LIMIT_REACHED') setDialog({ open: true, kind: 'limit', msg });
      else setDialog({ open: true, kind: 'blocked' });
      refresh();
    };
    window.addEventListener('wacrm:plan-required', onPlanRequired);
    return () => window.removeEventListener('wacrm:plan-required', onPlanRequired);
  }, [refresh]);

  // Tell the user once per browser session, not on every page
  useEffect(() => {
    if (!isInactive || pathname?.startsWith('/dashboard/billing') || pathname?.startsWith('/onboarding')) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* storage unavailable: still show it */
    }
    setDialog({ open: true, kind: 'blocked' });
  }, [isInactive, pathname]);

  const value = useMemo<PlanStatusValue>(
    () => ({
      state,
      isInactive,
      planTitle: plan?.title ?? null,
      expiredOn,
      trialDays,
      isClaiming,
      refresh,
      claimTrial,
      openUpgrade,
      requireActivePlan,
    }),
    [state, isInactive, plan?.title, expiredOn, trialDays, isClaiming, refresh, claimTrial, openUpgrade, requireActivePlan]
  );

  const close = () => setDialog((d) => ({ ...d, open: false }));
  const offerTrial = dialog.kind === 'blocked' && state === 'trial_available';

  return (
    <PlanStatusContext.Provider value={value}>
      {children}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-[420px]" initialFocus={bodyRef}>
          <div ref={bodyRef} tabIndex={-1} className="sr-only" aria-hidden />
          {dialog.kind === 'claimed' ? (
            <>
              <div className="flex flex-col items-center gap-4 pt-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success ring-8 ring-success/5 animate-in zoom-in-50 duration-300">
                  <Check className="size-7" strokeWidth={2.5} />
                </span>
                <DialogHeader className="items-center pr-0">
                  <DialogTitle>Your free trial is on</DialogTitle>
                  <DialogDescription>
                    Everything is unlocked for {trialDays} days
                    {claimedUntil ? `, until ${fmt(claimedUntil)}` : ''}. Start by connecting a WhatsApp number.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>
                  Later
                </Button>
                <Button render={<Link href="/dashboard/integrations" />} onClick={close}>
                  Connect WhatsApp
                  <ArrowRight />
                </Button>
              </DialogFooter>
            </>
          ) : offerTrial ? (
            <>
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gift className="size-5" />
              </div>
              <DialogHeader>
                <DialogTitle>Claim your {trialDays}-day free trial</DialogTitle>
                <DialogDescription>
                  {dialog.action ? `To ${dialog.action}, start your free trial first. ` : ''}
                  {isOwner
                    ? `Get the full product for ${trialDays} days: WhatsApp numbers, shared inbox, campaigns and chatbots. No card needed.`
                    : 'Ask the workspace owner to start the free trial.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>
                  Not now
                </Button>
                {isOwner && (
                  <Button onClick={claimTrial} disabled={isClaiming}>
                    {isClaiming ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {isClaiming ? 'Starting…' : 'Start free trial'}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl',
                  dialog.kind === 'blocked' ? 'bg-warning/12 text-warning' : 'bg-primary/10 text-primary'
                )}
              >
                {dialog.kind === 'blocked' ? <Lock className="size-5" /> : <Sparkles className="size-5" />}
              </div>
              <DialogHeader>
                <DialogTitle>
                  {dialog.kind === 'feature'
                    ? 'Upgrade to unlock this'
                    : dialog.kind === 'limit'
                      ? "You've reached your plan limit"
                      : state === 'expired'
                        ? 'Your plan has expired'
                        : 'Choose a plan to continue'}
                </DialogTitle>
                <DialogDescription>
                  {dialog.kind === 'feature' || dialog.kind === 'limit' ? (
                    <>
                      {dialog.msg || (dialog.kind === 'feature' ? 'This feature isn’t on your current plan.' : 'Your plan’s limit has been reached.')}{' '}
                      {isOwner ? 'Upgrade to get more.' : 'Ask the workspace owner to upgrade.'}
                    </>
                  ) : (
                    <>
                      {dialog.action ? `To ${dialog.action}, renew your plan. ` : ''}
                      {state === 'expired'
                        ? `${plan?.title ? `Your ${plan.title} plan` : 'Your plan'} ended${expiredOn ? ` on ${fmt(expiredOn)}` : ''}. `
                        : 'This workspace has no active plan. '}
                      {isOwner
                        ? 'Connecting numbers, sending messages, campaigns and automations are paused until you renew. Your contacts and chats are safe.'
                        : 'Ask the workspace owner to renew it. Your contacts and chats are safe.'}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={close}>
                  Not now
                </Button>
                {isOwner && (
                  <Button render={<Link href="/dashboard/billing" />} onClick={close}>
                    {state === 'expired' && dialog.kind === 'blocked' ? 'Renew plan' : 'See plans'}
                    <ArrowRight />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
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
      trialDays: 14,
      isClaiming: false,
      refresh: async () => {},
      claimTrial: async () => {},
      openUpgrade: () => {},
      requireActivePlan: () => true,
    };
  }
  return ctx;
}

/** Persistent strip under the header while the workspace has no usable plan. */
export function PlanExpiredBanner() {
  const { isInactive, state, planTitle, expiredOn, trialDays, claimTrial, isClaiming } = usePlanStatus();
  const { user } = useAuth();
  const pathname = usePathname();
  if (!isInactive || pathname?.startsWith('/dashboard/billing')) return null;
  // The home page shows the bigger claim card instead
  if (state === 'trial_available' && pathname === '/dashboard') return null;
  const isOwner = !user?.role || user.role === 'user';
  const isTrial = state === 'trial_available';

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 border-b px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6',
        isTrial ? 'border-primary/20 bg-primary/[0.06]' : 'border-warning/25 bg-warning/8'
      )}
    >
      <p className="flex items-start gap-2 text-foreground sm:items-center">
        {isTrial ? (
          <Gift className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0" />
        )}
        <span>
          <span className="font-semibold">
            {isTrial
              ? `Your ${trialDays}-day free trial is waiting.`
              : state === 'none'
                ? 'No active plan.'
                : `${planTitle ? `${planTitle} plan` : 'Plan'} expired${expiredOn ? ` on ${fmt(expiredOn)}` : ''}.`}
          </span>{' '}
          <span className="text-muted-foreground">
            {isTrial
              ? 'Start it to connect WhatsApp and send messages.'
              : 'Messaging, campaigns and new connections are paused.'}
          </span>
        </span>
      </p>
      {!isOwner ? (
        <span className="text-[13px] text-muted-foreground">
          Ask the workspace owner to {isTrial ? 'start the trial' : 'renew'}.
        </span>
      ) : isTrial ? (
        <Button size="sm" onClick={claimTrial} disabled={isClaiming} className="self-start sm:self-auto">
          {isClaiming ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isClaiming ? 'Starting…' : 'Start free trial'}
        </Button>
      ) : (
        <Button size="sm" render={<Link href="/dashboard/billing" />} className="self-start sm:self-auto">
          {state === 'none' ? 'See plans' : 'Renew plan'}
          <ArrowRight />
        </Button>
      )}
    </div>
  );
}

/** Prominent claim card for the dashboard home while the free trial is unclaimed. */
export function ClaimTrialCard() {
  const { state, trialDays, claimTrial, isClaiming } = usePlanStatus();
  const { user } = useAuth();
  if (state !== 'trial_available') return null;
  const isOwner = !user?.role || user.role === 'user';

  const perks = ['Connect WhatsApp numbers', 'Shared team inbox', 'Campaigns & chatbots'];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Gift className="size-3.5" />
            Welcome gift
          </span>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Your {trialDays}-day free trial is ready to claim
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Unlock the full product for {trialDays} days. No card needed, and nothing is charged when it ends.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-sm text-foreground">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          {isOwner ? (
            <>
              <Button size="xl" onClick={claimTrial} disabled={isClaiming}>
                {isClaiming ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isClaiming ? 'Starting your trial…' : 'Start free trial'}
              </Button>
              <Link href="/dashboard/billing" className="text-[13px] text-muted-foreground hover:text-foreground">
                or compare paid plans
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ask the workspace owner to start the trial.</p>
          )}
        </div>
      </div>
    </section>
  );
}
