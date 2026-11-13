'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api/client';
import { billingApi } from '@/lib/api/billing';
import type { SubscriptionPlan } from '@/types/billing';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Check, Loader2, QrCode, Cloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { readPricingChoice, clearPricingChoice, billingCheckoutHref, type PricingChoice } from '@/lib/billing/pricing-choice';

/* ---------------------------------------------------------------------------
 * Onboarding: the shortest path from sign-up to a connected WhatsApp number.
 *   1. Your details  (required — saves name, contact number, timezone)
 *   2. Your plan     (only when there is a decision: no active plan, or a paid
 *                     plan was picked on the pricing page before signing up)
 *   3. Connect WhatsApp (QR or Cloud API — opens the real connection flow)
 * After step 1 the dialog can be closed at any time; the dashboard keeps a
 * "Getting started" checklist for whatever is left.
 * ------------------------------------------------------------------------- */

const DRAFT_KEY = 'wacrm_onboarding_draft';

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function timezoneOptions(current: string) {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  if (!zones.length) {
    zones = ['Asia/Kolkata', 'UTC', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

type StepId = 'details' | 'plan' | 'connect';

interface OnboardingModalProps {
  open?: boolean;
  onComplete?: () => void;
}

export function OnboardingModal({ open = true, onComplete }: OnboardingModalProps) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [step, setStep] = useState<StepId>('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState<string>(() => browserTimezone());

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [pricingChoice, setPricingChoice] = useState<PricingChoice | null>(null);

  // Restore an unfinished draft (same tab), then fill gaps from the account
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (saved?.fullName) setFullName(saved.fullName);
      if (saved?.phone) setPhone(saved.phone);
      if (saved?.timezone) setTimezone(saved.timezone);
    } catch {
      // ignore unreadable draft
    }
    setPricingChoice(readPricingChoice());
  }, []);

  useEffect(() => {
    if (!user) return;
    setFullName((v) => v || user.name || '');
    setPhone((v) => v || user.mobile_with_country_code || '');
    if (user.timezone) setTimezone(user.timezone);
  }, [user]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ fullName, phone, timezone }));
    } catch {
      // storage unavailable
    }
  }, [fullName, phone, timezone]);

  useEffect(() => {
    billingApi
      .getPlans()
      .then((res) => {
        if (res.success && Array.isArray(res.plans)) setPlans(res.plans);
      })
      .catch(() => {
        // the plan step degrades to "see plans" without the list
      });
  }, []);

  // ── Plan state from the account (signup already starts the free trial) ──
  const [openedAt] = useState(() => Date.now()); // stable "now" for this dialog session
  const planExpireMs = Number(user?.plan_expire || 0);
  const hasActivePlan = planExpireMs > openedAt;
  const onTrial = hasActivePlan && Number(user?.trial) === 1;
  const currentPlanTitle =
    (typeof user?.plan === 'object' && user?.plan && 'title' in user.plan ? String(user.plan.title) : '') ||
    (onTrial ? 'Free trial' : 'Your plan');
  const trialPlan = plans.find((p) => Number(p.is_trial) === 1);
  const trialLabel = trialPlan ? `${Number(trialPlan.plan_duration_in_days) || 14}-day free trial` : 'Free trial';
  const chosenPlan = pricingChoice ? plans.find((p) => Number(p.id) === pricingChoice.planId) : undefined;
  const needsPlanStep = !hasActivePlan || Boolean(chosenPlan && !chosenPlan.is_trial);

  const steps = useMemo<StepId[]>(
    () => (needsPlanStep ? ['details', 'plan', 'connect'] : ['details', 'connect']),
    [needsPlanStep],
  );
  const stepIndex = steps.indexOf(step);

  const finish = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    onComplete?.();
  };

  const tryClose = () => {
    // Profile (step 1) is required; everything after can be done later from the dashboard
    if (profileSaved) finish();
  };

  // ── Step 1: save profile ──
  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError('Enter your name.');
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      return setError('Enter a contact number with the country code, for example +91 98200 00000.');
    }
    setSaving(true);
    try {
      const res = await api.post<{ success: boolean; msg?: string }>('/api/user/update_profile', {
        name: fullName.trim(),
        email: user?.email,
        mobile_with_country_code: phone.trim(),
        timezone,
      });
      if (!res?.success) throw new Error(res?.msg || 'Could not save your details.');
      setProfileSaved(true);
      await refreshUser();
      setStep(steps[1]);
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.message || 'Could not save your details. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: plan ──
  const startTrial = async () => {
    setSaving(true);
    setError(null);
    try {
      const res: any = await billingApi.activateTrial();
      if (!res?.success) throw new Error(res?.msg || 'Could not start the free trial.');
      await refreshUser();
      toast.success(res.alreadyActive ? 'Your free trial is active.' : 'Free trial started.');
      setStep('connect');
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.message || 'Could not start the free trial.');
    } finally {
      setSaving(false);
    }
  };

  const goToCheckout = () => {
    if (!pricingChoice) return;
    clearPricingChoice();
    finish();
    router.push(billingCheckoutHref(pricingChoice));
  };

  // ── Step 3: connect ──
  const connect = (method: 'qr' | 'cloud') => {
    finish();
    router.push(`/dashboard/integrations?connect=${method}`);
  };

  const title = step === 'details' ? 'Tell us about you' : step === 'plan' ? 'Choose how to start' : 'Connect WhatsApp';
  const description =
    step === 'details'
      ? 'We use this to set your inbox hours and reach you about your account.'
      : step === 'plan'
      ? 'You can change plans any time from Billing.'
      : 'Messages start arriving in your inbox as soon as a number is connected.';

  const body = (
    <div className="flex flex-col">
      {/* Progress: real sequence, so numbered */}
      <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < stepIndex && 'bg-primary text-primary-foreground',
                i === stepIndex && 'border-2 border-primary text-foreground',
                i > stepIndex && 'border border-border text-muted-foreground',
              )}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-xs', i === stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
              {s === 'details' ? 'Details' : s === 'plan' ? 'Plan' : 'Connect'}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === 'details' && (
        <form onSubmit={saveDetails} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ob-name">Your name</Label>
            <Input
              id="ob-name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>
          <PhoneInput
            id="ob-phone"
            label="Contact number"
            value={phone}
            onChange={(v: string) => setPhone(v || '')}
            helperText="For account notices. It does not have to be the number you connect to WhatsApp."
          />
          <div className="space-y-1.5">
            <Label htmlFor="ob-tz">Timezone</Label>
            <select
              id="ob-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {timezoneOptions(timezone).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Scheduled broadcasts and reports use this timezone.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving' : 'Save and continue'}
          </button>
        </form>
      )}

      {step === 'plan' && (
        <div className="space-y-3">
          {chosenPlan && !chosenPlan.is_trial && pricingChoice ? (
            <>
              <div className="rounded-2xl border-2 border-primary p-4">
                <p className="text-sm text-muted-foreground">You picked</p>
                <p className="mt-0.5 text-lg font-semibold">
                  {chosenPlan.title}, billed {pricingChoice.durationMonths === 12 ? 'yearly' : 'monthly'}
                </p>
                {hasActivePlan && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your free trial runs until {formatDate(planExpireMs)}. Paying now starts {chosenPlan.title} straight
                    away.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={goToCheckout}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                Continue to payment
              </button>
              <button
                type="button"
                onClick={() => (hasActivePlan ? setStep('connect') : startTrial())}
                disabled={saving}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-medium hover:bg-muted"
              >
                {hasActivePlan ? 'Stay on the free trial for now' : 'Start the free trial instead'}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-lg font-semibold">{trialLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every feature, no card needed. Pick a paid plan whenever you are ready.
                </p>
              </div>
              <button
                type="button"
                onClick={startTrial}
                disabled={saving}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Start free trial
              </button>
              <button
                type="button"
                onClick={() => {
                  finish();
                  router.push('/dashboard/billing');
                }}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-medium hover:bg-muted"
              >
                See paid plans
              </button>
            </>
          )}
        </div>
      )}

      {step === 'connect' && (
        <div className="space-y-3">
          {hasActivePlan && (
            <p className="text-sm text-muted-foreground">
              {currentPlanTitle} is active until {formatDate(planExpireMs)}.
            </p>
          )}
          <button
            type="button"
            onClick={() => connect('qr')}
            className="flex w-full items-start gap-4 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <QrCode className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Scan a QR code</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Use your existing WhatsApp or WhatsApp Business number. Takes about a minute.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => connect('cloud')}
            className="flex w-full items-start gap-4 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Cloud className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Connect the official Cloud API</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                For higher sending volumes and approved templates. Meta verifies your business first.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={finish}
            className="w-full py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            I will connect later
          </button>
        </div>
      )}
    </div>
  );

  const closeButton = profileSaved ? (
    <button
      type="button"
      onClick={tryClose}
      aria-label="Close setup"
      className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && tryClose()}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[94dvh] overflow-y-auto rounded-t-3xl p-5">
          {closeButton}
          <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
          <SheetDescription className="mb-5 text-sm">{description}</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && tryClose()}>
      <DialogContent showCloseButton={false} className="rounded-3xl p-7 sm:max-w-[520px]">
        {closeButton}
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        <DialogDescription className="mb-1 text-sm">{description}</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;
