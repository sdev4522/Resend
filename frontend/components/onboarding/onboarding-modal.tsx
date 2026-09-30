'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api/client';
import { billingApi } from '@/lib/api/billing';
import { SubscriptionPlan } from '@/types/billing';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Check,
  ShieldCheck,
  Clock,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

interface OnboardingModalProps {
  open?: boolean;
  onComplete?: () => void;
}

export function OnboardingModal({ open = true, onComplete }: OnboardingModalProps) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [currency, setCurrency] = useState<string>('USD');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Load saved state or populate from user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('wacrm_onboarding_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.workspaceName) setWorkspaceName(parsed.workspaceName);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.timezone) setTimezone(parsed.timezone);
          if (parsed.selectedPlanId) setSelectedPlanId(parsed.selectedPlanId);
          if (parsed.step && parsed.step >= 1 && parsed.step <= 3) setCurrentStep(parsed.step);
        }
      } catch (_) {}
    }
  }, []);

  // Pre-fill user details if empty
  useEffect(() => {
    if (user) {
      if (!workspaceName && user.name) setWorkspaceName(user.name);
      if (!phone && user.mobile_with_country_code) setPhone(user.mobile_with_country_code);
      if (user.timezone) setTimezone(user.timezone);
    }
  }, [user]);

  // Persist draft to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'wacrm_onboarding_draft',
        JSON.stringify({
          workspaceName,
          phone,
          timezone,
          selectedPlanId,
          step: currentStep,
        })
      );
    }
  }, [workspaceName, phone, timezone, selectedPlanId, currentStep]);

  // Load real plans from backend
  useEffect(() => {
    let isMounted = true;
    async function loadPlans() {
      setPlansLoading(true);
      try {
        const res = await billingApi.getPlans();
        if (isMounted && res.success && Array.isArray(res.plans)) {
          setPlans(res.plans);
          if (res.currencySymbol) setCurrencySymbol(res.currencySymbol);
          if (res.currency) setCurrency(res.currency);
          if (res.plans.length > 0 && selectedPlanId === null) {
            setSelectedPlanId(res.plans[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load plans for onboarding:', err);
      } finally {
        if (isMounted) setPlansLoading(false);
      }
    }
    loadPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  // Step 1 Validation & Next
  const handleStep1Next = () => {
    setError(null);
    if (!workspaceName.trim()) {
      setError('Please enter your workspace or business name.');
      return;
    }
    if (!phone || phone.length < 8) {
      setError('Please provide a valid phone number with country code.');
      return;
    }
    if (!timezone) {
      setError('Please select your primary timezone.');
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 Validation & Next
  const handleStep2Next = () => {
    setError(null);
    if (!selectedPlanId) {
      setError('Please select a plan to continue.');
      return;
    }
    setCurrentStep(3);
  };

  // Step 3 Completion & Submit
  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      // Update user profile with real business info and timezone
      await api.post('/api/user/update_profile', {
        name: workspaceName.trim(),
        email: user?.email,
        mobile_with_country_code: phone.trim(),
        timezone,
      });

      // Clear draft
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('wacrm_onboarding_draft');
      }

      await refreshUser();
      toast.success('Workspace setup complete! Welcome to WaCRM.');

      if (onComplete) {
        onComplete();
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Onboarding finish error:', err);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // Modal Step Indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between pb-3 border-b">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
        </div>
        <span className={cn('text-xs font-medium', currentStep === 1 ? 'text-foreground' : 'text-muted-foreground')}>
          Workspace
        </span>
      </div>

      <div className="h-[1px] flex-1 mx-2 bg-border" />

      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
        </div>
        <span className={cn('text-xs font-medium', currentStep === 2 ? 'text-foreground' : 'text-muted-foreground')}>
          Plan Selection
        </span>
      </div>

      <div className="h-[1px] flex-1 mx-2 bg-border" />

      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
            currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          3
        </div>
        <span className={cn('text-xs font-medium', currentStep === 3 ? 'text-foreground' : 'text-muted-foreground')}>
          Finish
        </span>
      </div>
    </div>
  );

  // Content for Step 1
  const renderStep1 = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Workspace Profile
        </h3>
        <p className="text-xs text-muted-foreground">
          Tell us about your organization to personalize your messaging dashboard.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-ws-name" className="text-xs font-medium">
            Business / Organization Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onboarding-ws-name"
            placeholder="e.g. Acme Retailers"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboarding-phone" className="text-xs font-medium">
            Contact Phone Number <span className="text-destructive">*</span>
          </Label>
          <PhoneInput
            id="onboarding-phone"
            value={phone}
            onChange={setPhone}
            className="w-full text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Used for workspace alerts and account recovery.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboarding-timezone" className="text-xs font-medium">
            Timezone <span className="text-destructive">*</span>
          </Label>
          <select
            id="onboarding-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Campaigns and broadcasts will schedule in this timezone.</p>
        </div>
      </div>
    </div>
  );

  // Content for Step 2
  const renderStep2 = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Choose Your Plan
        </h3>
        <p className="text-xs text-muted-foreground">
          Select the tier that best matches your customer outreach volume. Real plans loaded from database.
        </p>
      </div>

      {plansLoading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading active plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <Alert>
          <AlertDescription className="text-xs">
            Standard trial active. You can select custom plans later from the billing portal.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
          {plans.map((p) => {
            const isSelected = selectedPlanId === p.id;
            const price = p.currencyPrices?.[currency] ?? p.price ?? 0;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={cn(
                  'relative flex flex-col justify-between p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 bg-card'
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{p.title}</span>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">
                      {currencySymbol}{price}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {p.plan_duration_in_days || 30} days
                    </span>
                  </div>

                  {p.short_description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.short_description}</p>
                  )}

                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {p.contact_limit && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        {p.contact_limit.toLocaleString()} Contacts
                      </Badge>
                    )}
                    {p.qr_account && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {p.qr_account} WhatsApp Session{p.qr_account > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {p.allow_chatbot === 1 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-emerald-600 border-emerald-200">
                        Chatbot Included
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md bg-muted/50 p-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-4 w-4 text-primary shrink-0" />
        <span>Your account includes a 14-day free trial. Payment activation happens only when you are ready.</span>
      </div>
    </div>
  );

  // Content for Step 3
  const renderStep3 = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" /> Ready to Launch!
        </h3>
        <p className="text-xs text-muted-foreground">
          Confirm your configuration details below to finalize setup and access your dashboard.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b">
          <span className="text-muted-foreground">Workspace Name:</span>
          <span className="font-semibold text-foreground">{workspaceName}</span>
        </div>
        <div className="flex items-center justify-between text-xs pb-2 border-b">
          <span className="text-muted-foreground">Contact Phone:</span>
          <span className="font-semibold text-foreground">{phone}</span>
        </div>
        <div className="flex items-center justify-between text-xs pb-2 border-b">
          <span className="text-muted-foreground">Timezone:</span>
          <span className="font-semibold text-foreground">{timezone}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Selected Plan:</span>
          <Badge className="bg-primary text-primary-foreground font-semibold">
            {selectedPlan?.title || 'Trial Plan'}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Post-Onboarding Highlights</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1.5 pl-5 list-disc">
          <li>
            <strong>WhatsApp Channel:</strong> Connect your device anytime under <em>Integrations &rarr; Connect WhatsApp</em>.
          </li>
          <li>
            <strong>Team Members:</strong> Invite agents and delegate inboxes from <em>Team Management</em>.
          </li>
          <li>
            <strong>Campaigns & Templates:</strong> Upload audience contacts and sync approved Meta templates immediately.
          </li>
        </ul>
      </div>
    </div>
  );

  const modalBody = (
    <div className="space-y-3">
      {renderStepIndicator()}

      {error && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between pt-3 border-t w-full">
      {currentStep > 1 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep((prev) => prev - 1)}
          disabled={loading}
          className="min-h-[44px] sm:min-h-[36px] px-4"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
      ) : (
        <div />
      )}

      {currentStep === 1 && (
        <Button
          type="button"
          size="sm"
          onClick={handleStep1Next}
          className="min-h-[44px] sm:min-h-[36px] px-5 bg-primary text-primary-foreground"
        >
          Continue to Plans <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}

      {currentStep === 2 && (
        <Button
          type="button"
          size="sm"
          onClick={handleStep2Next}
          className="min-h-[44px] sm:min-h-[36px] px-5 bg-primary text-primary-foreground"
        >
          Continue to Confirmation <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}

      {currentStep === 3 && (
        <Button
          type="button"
          size="sm"
          onClick={handleFinish}
          disabled={loading}
          className="min-h-[44px] sm:min-h-[36px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Workspace...
            </>
          ) : (
            <>
              Launch Dashboard <Sparkles className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </div>
  );

  // Render on Mobile as Sheet
  if (isMobile) {
    return (
      <Sheet open={open}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[92dvh] max-h-[92dvh] rounded-t-2xl p-4 flex flex-col justify-between overflow-hidden"
        >
          <SheetHeader className="text-left pb-1">
            <SheetTitle className="text-base font-bold">WaCRM Setup</SheetTitle>
            <SheetDescription className="text-xs">Complete 3 quick steps to initialize your CRM workspace.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-0.5">{modalBody}</div>
          <SheetFooter className="p-0 mt-2">{modalFooter}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  // Render on Desktop as Dialog
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[560px] p-5 rounded-2xl"
      >
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg font-bold">WaCRM Workspace Setup</DialogTitle>
          <DialogDescription className="text-xs">
            Complete these 3 quick steps to customize your messaging environment.
          </DialogDescription>
        </DialogHeader>
        {modalBody}
        <DialogFooter className="p-0 mt-1">{modalFooter}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default OnboardingModal;
