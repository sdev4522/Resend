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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Building2,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Check,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Lock,
  AlertCircle,
  QrCode,
  Users,
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

// Helper to dynamically load Razorpay Checkout SDK
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [currency, setCurrency] = useState<string>('INR');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Payment Execution State
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentStatusText, setPaymentStatusText] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [mockOrderPayload, setMockOrderPayload] = useState<any | null>(null);

  // Completed State for Step 4 Final Screen
  const [completedData, setCompletedData] = useState<{
    workspaceName: string;
    planTitle: string;
    statusText: string;
    expiryDate: string;
  } | null>(null);

  // Load saved draft or populate from user
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
          if (parsed.step && parsed.step >= 1 && parsed.step <= 3) {
            setCurrentStep(parsed.step);
          }
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
    if (typeof window !== 'undefined' && currentStep < 4) {
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

  // Load real plans and currency detection from backend
  useEffect(() => {
    let isMounted = true;
    async function loadPlansAndCurrency() {
      setPlansLoading(true);
      try {
        // Detect currency
        try {
          const currRes = await billingApi.detectCurrency();
          if (isMounted && currRes.success && currRes.currency) {
            setCurrency(currRes.currency);
            if (currRes.symbol) setCurrencySymbol(currRes.symbol);
          }
        } catch (_) {}

        // Fetch plans
        const res = await billingApi.getPlans();
        if (isMounted && res.success && Array.isArray(res.plans)) {
          setPlans(res.plans);
          if (res.currencySymbol) setCurrencySymbol(res.currencySymbol);
          if (res.currency) setCurrency(res.currency);

          // Default selection: select Free Trial if available, else first plan
          if (res.plans.length > 0 && selectedPlanId === null) {
            const trialPlan = res.plans.find((p) => p.is_trial === 1 || p.title.toLowerCase().includes('trial'));
            setSelectedPlanId(trialPlan ? trialPlan.id : res.plans[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load plans for onboarding:', err);
      } finally {
        if (isMounted) setPlansLoading(false);
      }
    }
    loadPlansAndCurrency();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || null;
  const isFreeTrial = selectedPlan ? Boolean(selectedPlan.is_trial === 1 || selectedPlan.title.toLowerCase().includes('trial')) : true;

  const getPlanPriceNumber = (p: SubscriptionPlan): number => {
    if (p.is_trial === 1) return 0;
    const explicit = (p as any).currencyPrices?.[currency];
    if (explicit !== undefined) return Number(explicit);
    return Number(p.price || 0);
  };

  // Step 1 Validation & Next
  const handleStep1Next = () => {
    setError(null);
    if (!workspaceName.trim()) {
      setError('Please enter your workspace or business name.');
      return;
    }
    if (!phone || phone.length < 8) {
      setError('Please provide a valid phone number with country calling code.');
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
      setError('Please choose a plan to continue.');
      return;
    }
    setPaymentError(null);
    setMockOrderPayload(null);
    setCurrentStep(3);
  };

  // Free Trial Activation Flow
  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    setPaymentError(null);

    try {
      // 1. Update user profile (workspace name, phone, timezone)
      await api.post('/api/user/update_profile', {
        name: workspaceName.trim(),
        email: user?.email,
        mobile_with_country_code: phone.trim(),
        timezone,
      });

      // 2. Authoritatively activate free trial on backend
      const trialRes = await billingApi.activateTrial();
      if (!trialRes || !trialRes.success) {
        throw new Error(trialRes?.msg || 'Failed to activate free trial');
      }

      // 3. Clear draft
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('wacrm_onboarding_draft');
      }

      // 4. Refresh authoritative auth user & state
      await refreshUser();

      const expiryDate = trialRes.newExpiry
        ? new Date(Number(trialRes.newExpiry)).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '14 days';

      setCompletedData({
        workspaceName: workspaceName.trim(),
        planTitle: trialRes.plan?.title || 'Free Trial',
        statusText: 'Trialing (14 days remaining)',
        expiryDate,
      });

      setCurrentStep(4);
      toast.success('14-day free trial activated!');
    } catch (err: any) {
      console.error('Trial activation error:', err);
      setError(err?.response?.data?.msg || err.message || 'Failed to activate trial.');
    } finally {
      setLoading(false);
    }
  };

  // Paid Plan Razorpay Checkout Flow
  const handleProceedToPayment = async () => {
    if (!selectedPlan) return;
    setIsProcessingPayment(true);
    setPaymentError(null);
    setError(null);

    try {
      // 1. Save workspace profile first
      await api.post('/api/user/update_profile', {
        name: workspaceName.trim(),
        email: user?.email,
        mobile_with_country_code: phone.trim(),
        timezone,
      });

      setPaymentStatusText('Creating secure order...');

      // 2. Backend authoritative order creation
      const orderData = await billingApi.createCheckoutOrder({
        planId: selectedPlan.id,
        currency: currency,
        autopay: false,
      });

      if (!orderData || !orderData.success) {
        throw new Error((orderData as any)?.msg || 'Failed to create payment order');
      }

      // 3. Check for mock dev/test environment
      if (orderData.isMock) {
        setPaymentStatusText('');
        setIsProcessingPayment(false);
        setMockOrderPayload(orderData);
        return;
      }

      // 4. Load Razorpay Checkout SDK
      setPaymentStatusText('Opening secure payment...');
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your connection.');
      }

      // 5. Razorpay Modal configuration
      const options: any = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Resend',
        description: `${selectedPlan.title} Plan Subscription`,
        order_id: orderData.orderId,
        prefill: {
          name: workspaceName.trim() || user?.name || '',
          email: user?.email || '',
          contact: phone.trim() || user?.mobile_with_country_code || '',
        },
        handler: async function (response: any) {
          try {
            setPaymentStatusText('Verifying payment with backend...');
            setIsProcessingPayment(true);

            // 6. Authoritative backend verification (never activate client-side)
            const verifyRes = await billingApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes && verifyRes.success) {
              // Clear draft
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('wacrm_onboarding_draft');
              }

              // Refresh authoritative backend session
              await refreshUser();

              const expiryDate = verifyRes.newExpiry
                ? new Date(Number(verifyRes.newExpiry)).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : `${selectedPlan.plan_duration_in_days || 30} days`;

              setCompletedData({
                workspaceName: workspaceName.trim(),
                planTitle: selectedPlan.title,
                statusText: 'Active / Paid',
                expiryDate,
              });

              setCurrentStep(4);
              toast.success(`Payment verified! ${selectedPlan.title} plan is active.`);
            } else {
              throw new Error(verifyRes?.msg || 'Signature verification failed.');
            }
          } catch (verifyErr: any) {
            console.error('Payment verification failed:', verifyErr);
            setPaymentError(
              verifyErr?.response?.data?.msg ||
                verifyErr.message ||
                'Payment verification failed. Your plan remains inactive.'
            );
          } finally {
            setIsProcessingPayment(false);
            setPaymentStatusText('');
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            setPaymentStatusText('');
            setPaymentError('Payment was cancelled. Your plan remains inactive.');
            toast.info('Payment cancelled. Paid plan was not activated.');
          },
        },
        theme: {
          color: '#10b981',
        },
      };

      const rzInstance = new (window as any).Razorpay(options);
      rzInstance.on('payment.failed', function (resp: any) {
        setIsProcessingPayment(false);
        setPaymentStatusText('');
        setPaymentError(`Payment failed: ${resp.error?.description || 'Transaction unsuccessful'}`);
        toast.error('Payment failed. Plan remains inactive.');
      });

      rzInstance.open();
    } catch (err: any) {
      console.error('Payment initiation error:', err);
      setPaymentError(err?.response?.data?.msg || err.message || 'Failed to initiate payment.');
      setIsProcessingPayment(false);
      setPaymentStatusText('');
    }
  };

  // Mock dev test simulation handler
  const handleSimulateMockVerification = async (shouldFailSignature = false) => {
    if (!mockOrderPayload || !selectedPlan) return;
    try {
      setIsProcessingPayment(true);
      setPaymentStatusText('Verifying with backend...');

      const orderId = mockOrderPayload.orderId;
      const paymentId = `pay_mock_${Date.now()}`;
      const testSecret = 'rzp_test_mock_key_secret';

      let signature = '';
      if (shouldFailSignature) {
        signature = 'invalid_mock_signature_' + Date.now();
      } else {
        const crypto = await import('crypto');
        signature = crypto
          .createHmac('sha256', testSecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');
      }

      const verifyRes = await billingApi.verifyPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      if (verifyRes && verifyRes.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('wacrm_onboarding_draft');
        }
        await refreshUser();
        const expiryDate = verifyRes.newExpiry
          ? new Date(Number(verifyRes.newExpiry)).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : `${selectedPlan.plan_duration_in_days || 30} days`;

        setCompletedData({
          workspaceName: workspaceName.trim(),
          planTitle: selectedPlan.title,
          statusText: 'Active / Paid',
          expiryDate,
        });

        setMockOrderPayload(null);
        setCurrentStep(4);
        toast.success(`Payment verified! ${selectedPlan.title} plan is active.`);
      } else {
        throw new Error(verifyRes?.msg || 'Signature verification failed');
      }
    } catch (err: any) {
      setPaymentError(err?.response?.data?.msg || err.message || 'Signature verification failed');
      toast.error('Payment rejected: Invalid signature');
    } finally {
      setIsProcessingPayment(false);
      setPaymentStatusText('');
    }
  };

  // Final Step Launch Dashboard
  const handleFinishLaunch = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('wacrm_onboarding_draft');
    }
    if (onComplete) {
      onComplete();
    } else {
      router.push('/dashboard');
    }
  };

  // Step Progress Header
  const renderStepIndicator = () => {
    if (currentStep === 4) return null;

    return (
      <div className="flex items-center justify-between pb-3.5 border-b mb-3">
        {/* Step 1 */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
          </div>
          <span className={cn('text-xs font-medium', currentStep === 1 ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            Workspace
          </span>
        </div>

        <div className="h-[1px] flex-1 mx-2.5 bg-border" />

        {/* Step 2 */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > 2 ? <Check className="h-3.5 w-3.5" /> : '2'}
          </div>
          <span className={cn('text-xs font-medium', currentStep === 2 ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            Plan
          </span>
        </div>

        <div className="h-[1px] flex-1 mx-2.5 bg-border" />

        {/* Step 3 */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > 3 ? <Check className="h-3.5 w-3.5" /> : '3'}
          </div>
          <span className={cn('text-xs font-medium', currentStep === 3 ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            {isFreeTrial ? 'Confirmation' : 'Payment'}
          </span>
        </div>
      </div>
    );
  };

  // STEP 1: Workspace Profile
  const renderStep1 = () => (
    <div className="space-y-4 py-1">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Set up your workspace
        </h3>
        <p className="text-xs text-muted-foreground">
          Enter your organization details and primary timezone to configure your messaging dashboard.
        </p>
      </div>

      <div className="space-y-3.5 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-ws-name" className="text-xs font-semibold text-foreground">
            Workspace Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onboarding-ws-name"
            placeholder="e.g. Acme Enterprises"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboarding-phone" className="text-xs font-semibold text-foreground">
            Contact Phone <span className="text-destructive">*</span>
          </Label>
          <PhoneInput
            id="onboarding-phone"
            value={phone}
            onChange={setPhone}
            className="w-full text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Used for workspace security alerts and support recovery.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboarding-timezone" className="text-xs font-semibold text-foreground">
            Timezone <span className="text-destructive">*</span>
          </Label>
          <select
            id="onboarding-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Broadcast schedules and automation flows run in this timezone.</p>
        </div>
      </div>
    </div>
  );

  // STEP 2: Choose Plan
  const renderStep2 = () => (
    <div className="space-y-3.5 py-1">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Choose your plan
        </h3>
        <p className="text-xs text-muted-foreground">
          Select a tier matching your messaging volume. Prices and features reflect live backend database settings.
        </p>
      </div>

      {plansLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading plans from database...</p>
        </div>
      ) : plans.length === 0 ? (
        <Alert>
          <AlertDescription className="text-xs">
            Standard trial active. You can upgrade plans anytime from the billing portal.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {plans.map((p) => {
            const isSelected = selectedPlanId === p.id;
            const isPlanTrial = p.is_trial === 1 || p.title.toLowerCase().includes('trial');
            const price = getPlanPriceNumber(p);
            const duration = p.plan_duration_in_days || (isPlanTrial ? 14 : 30);
            const contactLimit = Number(p.contact_limit || 0);
            const qrLimit = p.qr_account || 1;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={cn(
                  'relative flex flex-col justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/40 bg-card hover:bg-card/80'
                )}
              >
                {/* Header: Title & Checkmark */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className="font-bold text-sm text-foreground uppercase tracking-tight">
                        {p.title}
                      </h4>
                      {isPlanTrial && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Genuine Free Trial
                        </Badge>
                      )}
                    </div>

                    <div
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center border text-xs transition-colors shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-muted-foreground/30 text-transparent'
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="pt-0.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-foreground font-mono">
                        {isPlanTrial ? 'FREE' : `${currencySymbol}${price.toLocaleString()}`}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {isPlanTrial ? '/ 14 days' : `/ ${duration} days`}
                      </span>
                    </div>
                  </div>

                  {/* 3-5 Core Limits/Features */}
                  <div className="space-y-1.5 pt-2 border-t text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Users className="h-3 w-3 text-primary shrink-0" />
                      <span>{contactLimit === 0 ? 'Unlimited Contacts' : `${contactLimit.toLocaleString()} Contacts`}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <QrCode className="h-3 w-3 text-primary shrink-0" />
                      <span>{qrLimit} WhatsApp session{qrLimit > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Chatbots & Flows</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span>Developer API</span>
                    </div>
                  </div>
                </div>

                {/* Card CTA/State */}
                <div className="pt-3">
                  <div
                    className={cn(
                      'w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/80 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {isPlanTrial
                      ? isSelected ? 'Selected (Free Trial)' : 'Start Free Trial'
                      : isSelected ? `Selected (${p.title})` : `Choose ${p.title}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Informative notice bar */}
      <div className="rounded-lg bg-muted/50 p-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-4 w-4 text-primary shrink-0" />
        {isFreeTrial ? (
          <span>Free Trial gives 14 days of full feature access with no credit card or payment required.</span>
        ) : (
          <span>Paid plans require Razorpay checkout and activate immediately upon verified payment.</span>
        )}
      </div>
    </div>
  );

  // STEP 3: Review & Payment (or Free Trial Confirmation)
  const renderStep3 = () => {
    if (!selectedPlan) return null;

    const price = getPlanPriceNumber(selectedPlan);
    const duration = selectedPlan.plan_duration_in_days || (isFreeTrial ? 14 : 30);

    return (
      <div className="space-y-4 py-1">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            {isFreeTrial ? (
              <>
                <Sparkles className="h-4 w-4 text-emerald-600" /> You&apos;re ready to go
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-primary" /> Review your plan
              </>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            {isFreeTrial
              ? 'Review your configuration below and start your 14-day free trial immediately.'
              : 'Review your selected plan and proceed to secure Razorpay checkout.'}
          </p>
        </div>

        {/* Configuration Overview Card */}
        <div className="rounded-xl border bg-card p-3.5 space-y-2.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-muted-foreground">Workspace Name:</span>
            <span className="font-semibold text-foreground">{workspaceName}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-muted-foreground">Contact Phone:</span>
            <span className="font-semibold text-foreground">{phone}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-muted-foreground">Timezone:</span>
            <span className="font-semibold text-foreground">{timezone}</span>
          </div>

          {/* Plan Specific Details */}
          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-muted-foreground">Selected Plan:</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-foreground">{selectedPlan.title}</span>
              <Badge className={isFreeTrial ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'}>
                {isFreeTrial ? '14 Days Free' : `${currencySymbol}${price}`}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b">
            <span className="text-muted-foreground">Billing Period:</span>
            <span className="font-semibold text-foreground">{duration} days</span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-muted-foreground font-medium">Total Due Now:</span>
            <span className="text-base font-black text-foreground font-mono">
              {isFreeTrial ? '₹0 (Free)' : `${currencySymbol}${price.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Payment Error Alert */}
        {paymentError && (
          <Alert variant="destructive" className="py-2.5 text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Payment Issue</AlertTitle>
            <AlertDescription className="text-xs">{paymentError}</AlertDescription>
          </Alert>
        )}

        {/* Payment Processing Notice */}
        {isProcessingPayment && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col items-center justify-center gap-2 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-semibold text-foreground">{paymentStatusText || 'Processing payment...'}</p>
            <p className="text-[11px] text-muted-foreground">Please do not close this window while we verify your transaction with the backend.</p>
          </div>
        )}

        {/* Mock Dev Environment Simulation Card */}
        {mockOrderPayload && !isProcessingPayment && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Dev / Mock Gateway Mode Detected</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mock order #{mockOrderPayload.orderId} created. Simulate backend signature verification below:
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => handleSimulateMockVerification(false)}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1"
              >
                Simulate Payment Success
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSimulateMockVerification(true)}
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Simulate Signature Failure
              </Button>
            </div>
          </div>
        )}

        {/* Security badge / trial guarantees */}
        <div className="rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>{isFreeTrial ? 'Genuine Free Trial Terms' : 'Authoritative Payment Protection'}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isFreeTrial
              ? 'Your 14-day free trial activates with genuine zero cost. Full contact management, WhatsApp connection, and workflows are available without entering payment info.'
              : 'Payments are authoritatively verified by backend HMAC signature before activating your plan. Subscriptions remain inactive until payment confirmation.'}
          </p>
        </div>
      </div>
    );
  };

  // STEP 4: Final Success Screen (PART 4)
  const renderStep4 = () => (
    <div className="space-y-4 py-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2 shadow-xs">
        <CheckCircle2 className="h-8 w-8" />
      </div>

      <div className="space-y-1">
        <h3 className="text-xl font-bold text-foreground">Workspace ready</h3>
        <p className="text-xs text-muted-foreground">Your workspace is ready.</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2 text-xs text-left max-w-sm mx-auto shadow-2xs">
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">Workspace Name:</span>
          <span className="font-semibold text-foreground">{completedData?.workspaceName || workspaceName}</span>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">Active Plan:</span>
          <Badge className="bg-primary text-primary-foreground font-semibold px-2 py-0.5">
            {completedData?.planTitle || selectedPlan?.title || 'Free Trial'}
          </Badge>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">Subscription Status:</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {completedData?.statusText || (isFreeTrial ? 'Trialing (14 days remaining)' : 'Active / Paid')}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">Expiry Date:</span>
          <span className="font-semibold text-foreground font-mono">{completedData?.expiryDate || '14 days'}</span>
        </div>
      </div>
    </div>
  );

  const modalBody = (
    <div className="space-y-2">
      {renderStepIndicator()}

      {error && (
        <Alert variant="destructive" className="py-2 text-xs mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between pt-3 border-t w-full">
      {currentStep > 1 && currentStep < 4 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setPaymentError(null);
            setMockOrderPayload(null);
            setCurrentStep((prev) => prev - 1);
          }}
          disabled={loading || isProcessingPayment}
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
          className="min-h-[44px] sm:min-h-[36px] px-5 bg-primary text-primary-foreground font-semibold"
        >
          Continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}

      {currentStep === 2 && (
        <Button
          type="button"
          size="sm"
          onClick={handleStep2Next}
          disabled={plansLoading || !selectedPlanId}
          className="min-h-[44px] sm:min-h-[36px] px-5 bg-primary text-primary-foreground font-semibold"
        >
          {isFreeTrial ? 'Continue to Confirmation' : 'Continue to Payment'}{' '}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}

      {currentStep === 3 && (
        <>
          {isFreeTrial ? (
            <Button
              type="button"
              size="sm"
              onClick={handleStartTrial}
              disabled={loading}
              className="min-h-[44px] sm:min-h-[36px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating Free Trial...
                </>
              ) : (
                <>
                  Start Free Trial <Sparkles className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleProceedToPayment}
              disabled={isProcessingPayment || loading}
              className="min-h-[44px] sm:min-h-[36px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {paymentStatusText || 'Opening Checkout...'}
                </>
              ) : (
                <>
                  Continue to Payment <Lock className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </>
      )}

      {currentStep === 4 && (
        <div className="w-full flex justify-center">
          <Button
            type="button"
            size="sm"
            onClick={handleFinishLaunch}
            className="min-h-[44px] sm:min-h-[38px] px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md"
          >
            Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // Render on Mobile as full-screen Sheet
  if (isMobile) {
    return (
      <Sheet open={open}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[94dvh] max-h-[94dvh] rounded-t-2xl p-4 flex flex-col justify-between overflow-hidden"
        >
          <SheetHeader className="text-left pb-1">
            <SheetTitle className="text-base font-bold">Resend Setup</SheetTitle>
            <SheetDescription className="text-xs">
              Complete these quick steps to initialize your messaging workspace.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-0.5">{modalBody}</div>
          <SheetFooter className="p-0 mt-2">{modalFooter}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  // Render on Desktop as centered Dialog (600–750px wide)
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[680px] p-6 rounded-2xl"
      >
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg font-bold">Resend Workspace Setup</DialogTitle>
          <DialogDescription className="text-xs">
            Complete these quick steps to customize your messaging environment.
          </DialogDescription>
        </DialogHeader>
        {modalBody}
        <DialogFooter className="p-0 mt-1">{modalFooter}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingModal;
