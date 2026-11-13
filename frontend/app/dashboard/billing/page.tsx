'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { formatCurrencyAmount } from '@/lib/currency/format';
import { useEntitlements } from '@/hooks/use-entitlements';
import { billingApi } from '@/lib/api/billing';
import {
  SubscriptionPlan,
  BillingOrder,
  PriceCalculationSummary,
} from '@/types/billing';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  RefreshCw,
  QrCode,
  Users,
  Check,
  Minus,
  Tag,
  CreditCard,
  Lock,
  Receipt,
  Repeat,
  Info,
  CircleCheck,
  ArrowRight,
  Globe,
  X,
} from 'lucide-react';
import { useCurrency } from '@/lib/currency/currency-context';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Helper to load Razorpay Checkout SDK dynamically
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

const fmtMode = (m?: string | null) =>
  m ? m.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';

const fmtDate = (v: number | string, withTime = false) =>
  new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

function UsageMeter({
  label,
  icon: Icon,
  used,
  limit,
  percentage,
}: {
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  percentage: number;
}) {
  const unlimited = limit === -1 || limit === 0;
  const pct = unlimited ? 0 : Math.min(100, percentage);
  const tone = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-warning' : 'bg-primary';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {label}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{used.toLocaleString()}</span>
          {unlimited ? ' · Unlimited' : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', unlimited ? 'bg-primary/30' : tone)}
          style={{ width: unlimited ? '100%' : `${Math.max(pct, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      {!unlimited && pct >= 80 && (
        <p className={cn('text-xs', pct >= 100 ? 'text-destructive' : 'text-warning')}>
          {pct >= 100 ? 'Limit reached. Upgrade to add more.' : `${Math.round(pct)}% used. Consider upgrading soon.`}
        </p>
      )}
    </div>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon: Icon,
  tag,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon?: React.ElementType;
  tag?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/35',
        selected
          ? 'border-primary bg-primary/[0.04] shadow-[0_0_0_1px_var(--primary)]'
          : 'border-border bg-background hover:border-foreground/20 hover:bg-accent/40'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-primary bg-primary' : 'border-input bg-background'
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {tag && <Badge variant="success" className="h-5 px-1.5">{tag}</Badge>}
        </span>
        <span className="block text-[13px] leading-snug text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function SummaryRow({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 text-sm', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default function BillingPage() {
  const {
    data: planDetails,
    loading: isEntitlementsLoading,
    plan,
    isExpired,
    daysLeft,
    hasFeature,
    getUsage,
    refresh,
  } = useEntitlements();

  const isValid = planDetails?.isValid ?? true;
  const contactsUsage = getUsage('contacts');
  const qrAccountsUsage = getUsage('qr_accounts');

  // Plans state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  // Global Multi-Currency from Header context
  const {
    selectedCurrency,
    currencySymbol,
    activeRate: activeCurrencyRate,
    isAutoDetected,
    detectedCountry,
  } = useCurrency();


  // Orders & Autopay state
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [autopayState, setAutopayState] = useState<{
    subscriptionId: string | null;
    status: string | null;
    isActive: boolean;
  }>({ subscriptionId: null, status: null, isActive: false });
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [isCancellingAutopay, setIsCancellingAutopay] = useState(false);

  // Checkout Modal state
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [enableAutopay, setEnableAutopay] = useState<boolean>(true);
  // Billing term in months: 1 = monthly, 12 = one payment for a year (autopay is monthly-only)
  const [durationMonths, setDurationMonths] = useState<1 | 12>(1);
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [priceSummary, setPriceSummary] = useState<PriceCalculationSummary | null>(null);

  // Payment Execution state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState<string>('');
  const [mockOrderPayload, setMockOrderPayload] = useState<any | null>(null);

  // Payment Success Dialog state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<{
    planTitle: string;
    orderId: string;
    paymentId: string;
    newExpiry?: number;
    amount: string;
    isAutopay?: boolean;
  } | null>(null);

  // 1. Fetch available plans from backend
  const fetchPlans = useCallback(async () => {
    try {
      setIsPlansLoading(true);
      const res = await billingApi.getPlans();
      if (res && res.plans) {
        setPlans(res.plans);
      }
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      toast.error('Failed to load available plans from backend.');
    } finally {
      setIsPlansLoading(false);
    }
  }, []);




  // 2. Fetch billing orders history & autopay state
  const fetchOrders = useCallback(async () => {
    try {
      setIsOrdersLoading(true);
      const res = await billingApi.getOrders();
      if (res && res.orders) {
        setOrders(res.orders);
        if (res.autopay) {
          setAutopayState(res.autopay);
        }
      }
    } catch (err: any) {
      console.error('Failed to load order history:', err);
    } finally {
      setIsOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchOrders();
  }, [fetchPlans, fetchOrders]);

  // Recalculate price whenever checkout plan or applied coupon changes
  const recalculateCheckoutPrice = useCallback(
    async (planId: number, coupon?: string | null, targetCurrencyOverride?: string) => {
      try {
        setIsCalculatingPrice(true);
        const res = await billingApi.calculatePrice({
          planId,
          durationMonths,
          couponCode: coupon || undefined,
          currency: targetCurrencyOverride || selectedCurrency,
        });

        const summary = (res as any).pricing || (res as any).data;
        if (summary) {
          setPriceSummary(summary);
          
          if (summary.couponCode) {
            setAppliedCoupon(summary.couponCode);
            setCouponError(null);
          } else if (coupon) {
            setCouponError(summary.couponMessage || 'Coupon could not be applied');
            setAppliedCoupon(null);
          }
        }
      } catch (err: any) {
        console.error('Price calculation failed:', err);
        setCouponError(err.response?.data?.msg || err.message || 'Price calculation failed');
      } finally {
        setIsCalculatingPrice(false);
      }
    },
    [selectedCurrency, durationMonths]
  );

  // Synchronize modal pricing with global header currency selection
  useEffect(() => {
    if (selectedCheckoutPlan) {
      recalculateCheckoutPrice(selectedCheckoutPlan.id, appliedCoupon, selectedCurrency);
    }
  }, [selectedCurrency, selectedCheckoutPlan, appliedCoupon, recalculateCheckoutPrice]);

  // Handle opening checkout modal
  const handleOpenCheckout = (targetPlan: SubscriptionPlan, months: 1 | 12 = 1) => {
    // Year-long plans are a single term; only monthly plans can be bought for 12 months
    const term: 1 | 12 = Number(targetPlan.plan_duration_in_days) >= 365 ? 1 : months;
    setSelectedCheckoutPlan(targetPlan);
    setDurationMonths(term);
    setEnableAutopay(term === 1);
    setCouponInput('');
    setAppliedCoupon(null);
    setCouponError(null);
    setMockOrderPayload(null);
    recalculateCheckoutPrice(targetPlan.id, null, selectedCurrency);
  };

  // Arriving from pricing/onboarding: /dashboard/billing?plan=<id>&months=<1|12> opens that checkout once
  const checkoutIntentHandledRef = React.useRef(false);
  useEffect(() => {
    if (checkoutIntentHandledRef.current || !plans.length) return;
    const params = new URLSearchParams(window.location.search);
    const planId = Number(params.get('plan'));
    if (!planId) return;
    checkoutIntentHandledRef.current = true;
    window.history.replaceState(null, '', '/dashboard/billing');
    const target = plans.find((p) => Number(p.id) === planId && !p.is_trial);
    if (target) handleOpenCheckout(target, params.get('months') === '12' ? 12 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  // Handle coupon application
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    if (!selectedCheckoutPlan) return;

    try {
      setIsApplyingCoupon(true);
      setCouponError(null);
      const res = await billingApi.validateCoupon({
        code: couponInput.trim(),
        planId: selectedCheckoutPlan.id,
        durationMonths,
        currency: selectedCurrency,
      });

      if (res && res.valid) {
        setAppliedCoupon(res.couponCode);
        setPriceSummary(res.pricing);
        toast.success(`Coupon ${res.couponCode} applied successfully!`);
      } else {
        setCouponError(res.message || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err: any) {
      const msg = err.response?.data?.msg || err.message || 'Failed to apply coupon';
      setCouponError(msg);
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Remove applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    if (selectedCheckoutPlan) {
      recalculateCheckoutPrice(selectedCheckoutPlan.id, null);
    }
  };

  // Handle Cancel Autopay
  const handleCancelAutopay = async () => {
    try {
      setIsCancellingAutopay(true);
      const res = await billingApi.cancelAutopay();
      if (res && res.success) {
        toast.success(res.msg || 'Autopay cancelled successfully');
        await fetchOrders();
      } else {
        toast.error(res?.msg || 'Failed to cancel autopay');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.msg || err.message || 'Failed to cancel autopay');
    } finally {
      setIsCancellingAutopay(false);
    }
  };

  // Handle Proceed to Payment (Autopay or One-Time)
  const handleProceedPayment = async () => {
    if (!selectedCheckoutPlan) return;

    try {
      setIsProcessingPayment(true);
      setPaymentStatusText(enableAutopay ? 'Setting up Autopay subscription...' : 'Creating secure order...');

      // 1. Backend creates authoritative Razorpay order or Subscription
      const orderData = await billingApi.createCheckoutOrder({
        planId: selectedCheckoutPlan.id,
        couponCode: appliedCoupon || undefined,
        autopay: enableAutopay && durationMonths === 1,
        durationMonths,
        currency: selectedCurrency,
      });

      if (!orderData || !orderData.success) {
        throw new Error('Failed to create payment order');
      }

      // 2. Check if running in mock/dev test mode
      if (orderData.isMock) {
        setPaymentStatusText('');
        setIsProcessingPayment(false);
        setMockOrderPayload(orderData);
        return;
      }

      // 3. Load Razorpay Checkout SDK
      setPaymentStatusText('Opening Razorpay Checkout...');
      const isSdkLoaded = await loadRazorpayScript();
      if (!isSdkLoaded) {
        throw new Error('Could not load Razorpay SDK. Please check your internet connection.');
      }

      // 4. Configure Razorpay options (subscription_id for Autopay, order_id for one-time)
      const isSub = Boolean(orderData.isAutopay && orderData.subscriptionId);
      const options: any = {
        key: orderData.keyId,
        amount: orderData.amount, // minor units
        currency: orderData.currency,
        name: 'Resend',
        description: isSub
          ? `${selectedCheckoutPlan.title} Autopay Subscription`
          : `${selectedCheckoutPlan.title} Plan Subscription`,
        ...(isSub
          ? { subscription_id: orderData.subscriptionId }
          : { order_id: orderData.orderId }),
        handler: async function (response: any) {
          try {
            setPaymentStatusText('Verifying payment signature with backend...');
            setIsProcessingPayment(true);

            // 5. Backend authoritative verification
            const verifyRes = await billingApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes && verifyRes.success) {
              setSelectedCheckoutPlan(null);
              setSuccessReceipt({
                planTitle: selectedCheckoutPlan.title,
                orderId: response.razorpay_subscription_id || response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                newExpiry: verifyRes.newExpiry,
                amount: formatCurrencyAmount(orderData.pricing?.finalAmount, priceSummary?.currency || selectedCurrency, currencySymbol),
                isAutopay: isSub,
              });
              setSuccessDialogOpen(true);
              toast.success(isSub ? 'Autopay subscription activated!' : 'Payment verified! Plan activated.');
              await refresh();
              await fetchOrders();
            } else {
              throw new Error(verifyRes?.msg || 'Signature verification failed.');
            }
          } catch (verifyErr: any) {
            console.error('Verification error:', verifyErr);
            toast.error(verifyErr.response?.data?.msg || verifyErr.message || 'Payment verification failed');
          } finally {
            setIsProcessingPayment(false);
            setPaymentStatusText('');
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            setPaymentStatusText('');
            toast.info('Payment cancelled. Your current plan remains unchanged.');
          },
        },
        theme: {
          color: '#10b981',
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on('payment.failed', function (resp: any) {
        setIsProcessingPayment(false);
        setPaymentStatusText('');
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction unsuccessful'}`);
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.response?.data?.msg || err.message || 'Failed to initiate payment');
      setIsProcessingPayment(false);
      setPaymentStatusText('');
    }
  };

  // Mock dev test verification handler
  const handleSimulateMockVerification = async (shouldFailSignature = false) => {
    if (!mockOrderPayload || !selectedCheckoutPlan) return;

    try {
      setIsProcessingPayment(true);
      setPaymentStatusText('Verifying with backend...');

      const signature = shouldFailSignature
        ? 'invalid_tampered_signature_dev'
        : 'mock_signature_dev_test';

      const verifyRes = await billingApi.verifyPayment({
        razorpay_order_id: mockOrderPayload.isAutopay ? undefined : mockOrderPayload.orderId,
        razorpay_subscription_id: mockOrderPayload.isAutopay ? mockOrderPayload.subscriptionId : undefined,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: signature,
      });

      if (verifyRes && verifyRes.success) {
        setSelectedCheckoutPlan(null);
        setMockOrderPayload(null);
        setSuccessReceipt({
          planTitle: selectedCheckoutPlan.title,
          orderId: mockOrderPayload.subscriptionId || mockOrderPayload.orderId,
          paymentId: `pay_mock_${Date.now()}`,
          newExpiry: verifyRes.newExpiry,
          amount: formatCurrencyAmount(mockOrderPayload.pricing?.finalAmount, priceSummary?.currency || selectedCurrency, currencySymbol),
          isAutopay: Boolean(mockOrderPayload.isAutopay),
        });
        setSuccessDialogOpen(true);
        toast.success(mockOrderPayload.isAutopay ? 'Test Autopay subscription activated!' : 'Test payment verified!');
        await refresh();
        await fetchOrders();
      } else {
        toast.error(verifyRes?.msg || 'Signature verification failed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.msg || err.message || 'Verification failed';
      toast.error(msg);
    } finally {
      setIsProcessingPayment(false);
      setPaymentStatusText('');
    }
  };

  const isLoading = isEntitlementsLoading || isPlansLoading;

  // ---- Derived display values -------------------------------------------------
  const priceFor = (p: SubscriptionPlan) => {
    const explicit = p.currencyPrices?.[selectedCurrency];
    return explicit !== undefined ? Number(explicit) : Math.round(Number(p.price || 0) * activeCurrencyRate * 100) / 100;
  };
  const strikeFor = (p: SubscriptionPlan) => {
    const explicit = (p as any).currencyStrikePrices?.[selectedCurrency];
    if (explicit !== undefined) return Number(explicit);
    return p.price_strike ? Math.round(Number(p.price_strike) * activeCurrencyRate * 100) / 100 : null;
  };
  const money = (v: number | undefined | null) => formatCurrencyAmount(v ?? 0, priceSummary?.currency || selectedCurrency, currencySymbol);

  const currentPrice = plan ? Number((plans.find((p) => p.id === plan.id) || plan).price || 0) : 0;
  const recommendedId = plans
    .filter((p) => !Number(p.is_trial) && p.id !== plan?.id && Number(p.price || 0) > currentPrice)
    .sort((x, y) => Number(x.price) - Number(y.price))[0]?.id;

  const checkoutAmount = selectedCheckoutPlan
    ? priceSummary?.finalAmount !== undefined
      ? priceSummary.finalAmount
      : priceFor(selectedCheckoutPlan)
    : 0;
  const isRenewal = Boolean(selectedCheckoutPlan && plan?.id === selectedCheckoutPlan.id);
  const isTrial = Number(plan?.is_trial) === 1;
  const isActive = isValid && !isExpired;

  const closeCheckout = () => {
    setSelectedCheckoutPlan(null);
    setMockOrderPayload(null);
  };
  const scrollToPlans = () => document.getElementById('available-plans-section')?.scrollIntoView({ behavior: 'smooth' });

  const planFeatures = (p: SubscriptionPlan) => [
    { label: Number(p.contact_limit || 0) === 0 ? 'Unlimited contacts' : `${Number(p.contact_limit).toLocaleString()} contacts`, on: true },
    { label: `${p.qr_account || 1} WhatsApp ${Number(p.qr_account || 1) === 1 ? 'number' : 'numbers'}`, on: true },
    { label: 'Chatbots & flows', on: Number(p.allow_chatbot) === 1 },
    { label: 'REST API & webhooks', on: Number(p.allow_api) === 1 },
    { label: 'WhatsApp warmer', on: Number((p as any).wa_warmer) === 1 },
    { label: 'Lead forms', on: Number((p as any).allow_wa_forms) === 1 },
  ];

  const entitlementList = [
    { name: 'Chatbot automation', description: 'Interactive flows and auto-replies', enabled: hasFeature('chatbot') },
    { name: 'REST API', description: 'Send messages from your own systems', enabled: hasFeature('api') },
    { name: 'Chat tags', description: 'Label and organise conversations', enabled: hasFeature('tags') },
    { name: 'Chat notes', description: 'Private notes for your team', enabled: hasFeature('notes') },
    { name: 'WhatsApp warmer', description: 'Warm up new numbers automatically', enabled: hasFeature('wa_warmer') },
    { name: 'WhatsApp forms', description: 'Collect submissions in chat', enabled: hasFeature('allow_wa_forms') },
    { name: 'QR sessions via API', description: 'Create and control QR sessions', enabled: hasFeature('rest_api_qr') },
    { name: 'Instagram inbox', description: 'Reply to Instagram DMs', enabled: hasFeature('instagram_inbox') },
    { name: 'Telegram inbox', description: 'Reply to Telegram messages', enabled: hasFeature('telegram_inbox') },
  ];

  const statusVariant = (s?: string) => {
    const v = s?.toLowerCase();
    return v === 'paid' ? 'success' : v === 'failed' ? 'destructive' : v === 'pending' || v === 'created' ? 'warning' : 'secondary';
  };

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Billing & plans"
        description="Your plan, usage and payment history."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await refresh();
              await fetchPlans();
              await fetchOrders();
              toast.success('Billing refreshed');
            }}
            disabled={isLoading}
          >
            <RefreshCw className={cn(isLoading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-52 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {!isActive && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircle />
              <AlertTitle>Your subscription is inactive</AlertTitle>
              <AlertDescription>Choose a plan below to turn messaging, automation and the inbox back on.</AlertDescription>
            </Alert>
          )}

          {/* ── Current plan ─────────────────────────────────────────── */}
          <Card className="gap-0 py-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
              <div className="flex flex-col justify-between gap-6 p-6 lg:border-r">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Current plan</p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                      {plan?.title || 'No active plan'}
                    </h2>
                    {plan && (
                      <Badge variant={isActive ? 'success' : 'destructive'}>
                        <span className={cn('size-1.5 rounded-full', isActive ? 'bg-success' : 'bg-destructive')} />
                        {isActive ? 'Active' : 'Expired'}
                      </Badge>
                    )}
                    {isTrial && <Badge variant="warning">Free trial</Badge>}
                    {autopayState.isActive && (
                      <Badge variant="info">
                        <Repeat />
                        Autopay on
                      </Badge>
                    )}
                  </div>
                  {plan?.short_description && (
                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{plan.short_description}</p>
                  )}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[13px] text-muted-foreground">
                      {planDetails?.plan_expire
                        ? autopayState.isActive && isActive
                          ? 'Renews on'
                          : isExpired
                            ? 'Expired on'
                            : 'Expires on'
                        : 'Validity'}
                    </p>
                    <p className="text-base font-semibold tabular-nums text-foreground">
                      {planDetails?.plan_expire ? fmtDate(Number(planDetails.plan_expire)) : 'No expiry'}
                      {planDetails?.plan_expire && !isExpired && daysLeft != null && (
                        <span
                          className={cn(
                            'ml-2 text-sm font-medium',
                            daysLeft <= 5 ? 'text-warning' : 'text-muted-foreground'
                          )}
                        >
                          · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {autopayState.isActive && (
                      <Button variant="ghost" size="sm" onClick={handleCancelAutopay} disabled={isCancellingAutopay}>
                        {isCancellingAutopay ? 'Cancelling…' : 'Cancel autopay'}
                      </Button>
                    )}
                    <Button onClick={scrollToPlans}>
                      {isActive && !isTrial ? 'Change plan' : 'Upgrade now'}
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6 border-t bg-muted/25 p-6 lg:border-t-0">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Usage this cycle</p>
                <UsageMeter
                  label="Contacts"
                  icon={Users}
                  used={contactsUsage.used}
                  limit={contactsUsage.limit}
                  percentage={contactsUsage.percentage}
                />
                <UsageMeter
                  label="WhatsApp numbers"
                  icon={QrCode}
                  used={qrAccountsUsage.used}
                  limit={qrAccountsUsage.limit}
                  percentage={qrAccountsUsage.percentage}
                />
              </div>
            </div>
          </Card>

          {/* ── Plans ────────────────────────────────────────────────── */}
          <section id="available-plans-section" className="scroll-mt-6 space-y-5">
            <SectionHeading
              title="Plans"
              description="Upgrade or renew anytime. Changes apply instantly."
              action={
                <span className="inline-flex items-center gap-1.5 self-start rounded-full border bg-background px-3 py-1 text-[13px] text-muted-foreground sm:self-auto">
                  <Globe className="size-3.5" />
                  Prices in <span className="font-medium text-foreground">{selectedCurrency}</span>
                  {isAutoDetected && detectedCountry ? <span>· {detectedCountry}</span> : null}
                </span>
              }
            />

            {plans.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center text-sm text-muted-foreground">
                No plans are available right now. Please contact support.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((p) => {
                  const isCurrent = plan?.id === p.id;
                  const trial = Number(p.is_trial) === 1;
                  const recommended = p.id === recommendedId;
                  const price = priceFor(p);
                  const strike = strikeFor(p);
                  const days = Number(p.plan_duration_in_days) || (trial ? 14 : 30);
                  const period = days >= 365 ? 'year' : days >= 28 && days <= 31 ? 'month' : `${days} days`;

                  return (
                    <Card
                      key={p.id}
                      className={cn(
                        'relative gap-0 py-0 transition-shadow',
                        isCurrent && 'border-primary shadow-[0_0_0_1px_var(--primary)]',
                        recommended && !isCurrent && 'border-foreground/15 shadow-[0_8px_24px_-12px_rgb(16_24_40/0.18)]'
                      )}
                    >
                      <div className="flex flex-1 flex-col gap-6 p-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
                            {isCurrent ? (
                              <Badge variant="default">Current</Badge>
                            ) : recommended ? (
                              <Badge variant="solid">Recommended</Badge>
                            ) : null}
                          </div>
                          <p className="line-clamp-2 min-h-10 text-[13px] leading-relaxed text-muted-foreground">
                            {p.short_description || 'Everything you need to run WhatsApp for your business.'}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                              {trial ? 'Free' : formatCurrencyAmount(price, selectedCurrency, currencySymbol)}
                            </span>
                            {!trial && <span className="text-sm text-muted-foreground">/ {period}</span>}
                          </div>
                          <p className="h-5 text-[13px] text-muted-foreground">
                            {trial ? (
                              `${days}-day trial · no card needed`
                            ) : strike && strike > price ? (
                              <>
                                <span className="line-through">{formatCurrencyAmount(strike, selectedCurrency, currencySymbol)}</span>
                                <span className="ml-1.5 font-medium text-success">
                                  Save {Math.round(((strike - price) / strike) * 100)}%
                                </span>
                              </>
                            ) : (
                              'Autopay available · cancel anytime'
                            )}
                          </p>
                        </div>

                        <ul className="space-y-2.5 border-t pt-5">
                          {planFeatures(p).map((f) => (
                            <li
                              key={f.label}
                              className={cn('flex items-center gap-2.5 text-sm', f.on ? 'text-foreground' : 'text-muted-foreground/70')}
                            >
                              {f.on ? (
                                <span className="flex size-4 items-center justify-center rounded-full bg-primary/12 text-primary">
                                  <Check className="size-3" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="flex size-4 items-center justify-center text-muted-foreground/50">
                                  <Minus className="size-3.5" />
                                </span>
                              )}
                              {f.label}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-6 pt-0">
                        {trial ? (
                          <div className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                            {isCurrent && <Check className="size-4 text-primary" />}
                            {isCurrent ? 'Your current plan' : 'Included with signup'}
                          </div>
                        ) : (
                          <Button
                            variant={isCurrent ? 'outline' : recommended ? 'default' : 'outline'}
                            size="lg"
                            className="w-full"
                            onClick={() => handleOpenCheckout(p)}
                          >
                            {isCurrent ? 'Renew plan' : `Choose ${p.title}`}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Included features ───────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading title="What your plan includes" description="Features unlocked on your current subscription." />
            <Card className="py-0">
              <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 [&>*]:border-border sm:[&>*]:border-b lg:[&>*:nth-last-child(-n+3)]:border-b-0">
                {entitlementList.map((feat) => (
                  <div key={feat.name} className="flex items-start gap-3 px-5 py-4">
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                        feat.enabled ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {feat.enabled ? <Check className="size-3" strokeWidth={3} /> : <Lock className="size-2.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', feat.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                        {feat.name}
                      </p>
                      <p className="text-[13px] text-muted-foreground">{feat.enabled ? feat.description : 'Not on your plan'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* ── Payment history ─────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading
              title="Payment history"
              description="Receipts for every payment on this workspace."
              action={
                <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={isOrdersLoading} className="self-start sm:self-auto">
                  <RefreshCw className={cn(isOrdersLoading && 'animate-spin')} />
                  Refresh
                </Button>
              }
            />
            <Card className="py-0">
              {isOrdersLoading ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Receipt className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">No payments yet</p>
                    <p className="text-[13px] text-muted-foreground">Your receipts will show up here after your first payment.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile list */}
                  <div className="divide-y md:hidden">
                    {orders.map((ord) => (
                      <div key={ord.id} className="space-y-2 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{ord.planTitle}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(ord.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrencyAmount(ord.amount, ord.currency || selectedCurrency, currencySymbol)}
                            </p>
                            <Badge variant={statusVariant(ord.status)} className="mt-1 capitalize">
                              {ord.status?.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{fmtMode(ord.paymentMode)}</span>
                          {ord.isAutopay && <span>· Autopay</span>}
                          {ord.couponCode && <span>· {ord.couponCode}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">Date</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Coupon</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="pr-6">Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((ord) => (
                          <TableRow key={ord.id}>
                            <TableCell className="pl-6 text-muted-foreground">{fmtDate(ord.createdAt)}</TableCell>
                            <TableCell className="font-medium text-foreground">{ord.planTitle}</TableCell>
                            <TableCell className="font-medium tabular-nums text-foreground">
                              {formatCurrencyAmount(ord.amount, ord.currency || selectedCurrency, currencySymbol)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <span>{fmtMode(ord.paymentMode)}</span>
                              {ord.isAutopay && (
                                <Badge variant="info" className="ml-2">
                                  Autopay
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {ord.couponCode ? (
                                <span className="font-mono text-xs">
                                  {ord.couponCode}
                                  <span className="ml-1 text-success">−{currencySymbol}{ord.couponDiscount}</span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(ord.status)} className="capitalize">
                                {ord.status?.toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-6 font-mono text-xs text-muted-foreground" title={ord.orderId || undefined}>
                              {ord.orderId ? `${ord.orderId.slice(0, 18)}…` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Card>
          </section>

          {/* ── Checkout dialog ─────────────────────────────────────── */}
          <Dialog
            open={!!selectedCheckoutPlan}
            onOpenChange={(open) => {
              if (!open && !isProcessingPayment) closeCheckout();
            }}
          >
            <DialogContent className="gap-0 sm:max-w-[520px]">
              {selectedCheckoutPlan && (
                <>
                  <DialogHeader className="pb-5">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-primary">
                      {isRenewal ? 'Renew' : 'Upgrade'}
                    </p>
                    <DialogTitle className="text-xl">{selectedCheckoutPlan.title} plan</DialogTitle>
                    <DialogDescription>
                      {planFeatures(selectedCheckoutPlan)
                        .filter((f) => f.on)
                        .map((f) => f.label)
                        .join(' · ')}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 border-t pt-5">
                    {Number(selectedCheckoutPlan.plan_duration_in_days) < 365 && (
                      <div className="space-y-2.5">
                        <p className="text-sm font-medium text-foreground">Billing period</p>
                        <div
                          role="radiogroup"
                          aria-label="Billing period"
                          className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
                        >
                          {([1, 12] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              role="radio"
                              aria-checked={durationMonths === m}
                              onClick={() => {
                                setDurationMonths(m);
                                if (m === 12) setEnableAutopay(false);
                                setAppliedCoupon(null);
                                setCouponInput('');
                              }}
                              className={cn(
                                'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all',
                                durationMonths === m
                                  ? 'bg-background text-foreground shadow-[0_1px_3px_rgb(16_24_40/0.12)]'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {m === 1 ? 'Monthly' : 'Yearly'}
                              {m === 12 && <Badge variant="success" className="h-5 px-1.5">Save more</Badge>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {durationMonths === 1 && (
                      <div className="space-y-2.5">
                        <p className="text-sm font-medium text-foreground">Payment</p>
                        <div role="radiogroup" aria-label="Payment type" className="grid gap-2">
                          <OptionCard
                            selected={enableAutopay}
                            onSelect={() => setEnableAutopay(true)}
                            title="Autopay"
                            tag="Recommended"
                            description={`Renews every ${selectedCheckoutPlan.plan_duration_in_days || 30} days. Cancel anytime from Billing.`}
                          />
                          <OptionCard
                            selected={!enableAutopay}
                            onSelect={() => setEnableAutopay(false)}
                            title="Pay once"
                            description="Pay for one cycle. You'll renew manually before it ends."
                          />
                        </div>
                      </div>
                    )}

                    {/* Coupon */}
                    <div className="space-y-2">
                      <label htmlFor="coupon" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Tag className="size-3.5 text-muted-foreground" />
                        Coupon code
                      </label>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-success/25 bg-success/8 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm font-medium text-success">
                            <CircleCheck className="size-4" />
                            <span className="font-mono">{appliedCoupon}</span> applied
                          </span>
                          <Button variant="ghost" size="icon-xs" onClick={handleRemoveCoupon} aria-label="Remove coupon">
                            <X />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id="coupon"
                            placeholder="Enter code"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                            disabled={isApplyingCoupon || isCalculatingPrice}
                            aria-invalid={!!couponError || undefined}
                            className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                          />
                          <Button
                            variant="outline"
                            onClick={handleApplyCoupon}
                            disabled={!couponInput.trim() || isApplyingCoupon || isCalculatingPrice}
                            className="min-w-20"
                          >
                            {isApplyingCoupon ? <RefreshCw className="animate-spin" /> : 'Apply'}
                          </Button>
                        </div>
                      )}
                      {couponError && (
                        <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {couponError}
                        </p>
                      )}
                    </div>

                    {/* Summary */}
                    <div className={cn('space-y-2.5 rounded-xl bg-muted/50 p-4 transition-opacity', isCalculatingPrice && 'opacity-60')}>
                      <SummaryRow
                        label={`${selectedCheckoutPlan.title} · ${durationMonths === 12 ? '12 months' : `${selectedCheckoutPlan.plan_duration_in_days || 30} days`}`}
                        value={money(priceSummary?.baseSubtotal ?? priceFor(selectedCheckoutPlan))}
                      />
                      {(priceSummary?.durationDiscount || 0) > 0 && (
                        <SummaryRow
                          label="Yearly discount"
                          value={<span className="text-success">−{money(priceSummary?.durationDiscount)}</span>}
                        />
                      )}
                      {(priceSummary?.couponDiscount || 0) > 0 && (
                        <SummaryRow
                          label={`Coupon ${priceSummary?.couponCode ?? ''}`}
                          value={<span className="text-success">−{money(priceSummary?.couponDiscount)}</span>}
                        />
                      )}
                      {(priceSummary?.taxAmount || 0) > 0 && (
                        <SummaryRow label={`Tax (${priceSummary?.taxRate}%)`} value={money(priceSummary?.taxAmount)} />
                      )}
                      <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Total due today</p>
                          <p className="text-xs text-muted-foreground">
                            {enableAutopay && durationMonths === 1 ? 'Then renews automatically' : 'One-time payment'}
                          </p>
                        </div>
                        <p className="text-2xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                          {money(checkoutAmount)}
                        </p>
                      </div>
                    </div>

                    {mockOrderPayload && (
                      <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/8 p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-warning">
                          <Info className="size-4 shrink-0" />
                          Test mode
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          Razorpay is in test mode ({mockOrderPayload.isAutopay ? 'autopay' : 'one-time order'}). Simulate the result:
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSimulateMockVerification(false)} disabled={isProcessingPayment} className="flex-1">
                            <Check />
                            Simulate success
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive-outline"
                            onClick={() => handleSimulateMockVerification(true)}
                            disabled={isProcessingPayment}
                          >
                            Simulate failure
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="mt-6 items-center sm:justify-between">
                    <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <Lock className="size-3.5" />
                      Secured by Razorpay
                    </p>
                    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                      <Button variant="ghost" onClick={closeCheckout} disabled={isProcessingPayment}>
                        Cancel
                      </Button>
                      {!mockOrderPayload && (
                        <Button
                          onClick={handleProceedPayment}
                          disabled={isProcessingPayment || isCalculatingPrice}
                          className="min-w-44"
                        >
                          {isProcessingPayment ? (
                            <>
                              <RefreshCw className="animate-spin" />
                              {paymentStatusText || 'Processing…'}
                            </>
                          ) : (
                            <>
                              {enableAutopay && durationMonths === 1 ? <Repeat /> : <CreditCard />}
                              {enableAutopay && durationMonths === 1 ? 'Start autopay' : 'Pay'} · {money(checkoutAmount)}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* ── Payment success dialog ───────────────────────────────── */}
          <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
            <DialogContent className="sm:max-w-sm" showCloseButton={false}>
              <div className="flex flex-col items-center gap-4 pt-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success ring-8 ring-success/5">
                  <Check className="size-7" strokeWidth={2.5} />
                </span>
                <div className="space-y-1.5">
                  <DialogTitle>{successReceipt?.isAutopay ? 'Autopay is on' : 'Payment successful'}</DialogTitle>
                  <DialogDescription>
                    {successReceipt?.planTitle} is active on your workspace now.
                  </DialogDescription>
                </div>
              </div>

              {successReceipt && (
                <div className="space-y-2.5 rounded-xl bg-muted/50 p-4">
                  <SummaryRow label="Plan" value={successReceipt.planTitle} />
                  <SummaryRow label="Amount paid" value={successReceipt.amount} />
                  {successReceipt.newExpiry && (
                    <SummaryRow
                      label={successReceipt.isAutopay ? 'Next renewal' : 'Valid until'}
                      value={fmtDate(Number(successReceipt.newExpiry))}
                    />
                  )}
                  <SummaryRow
                    label="Reference"
                    value={<span className="font-mono text-xs text-muted-foreground">{successReceipt.orderId.slice(0, 20)}…</span>}
                  />
                </div>
              )}

              <Button size="lg" className="w-full" onClick={() => setSuccessDialogOpen(false)}>
                Done
              </Button>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
