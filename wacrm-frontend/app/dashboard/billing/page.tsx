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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  QrCode,
  Users,
  Zap,
  Check,
  Tag,
  CreditCard,
  Lock,
  Calendar,
  History,
  Info,
  CheckCircle,
  Repeat,
  ShieldX,
  Globe,
} from 'lucide-react';
import { SupportedBillingCurrency } from '@/types/billing';
import { useCurrency } from '@/lib/currency/currency-context';
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

function QuotaCard({
  title,
  icon: Icon,
  used,
  limit,
  remaining,
  percentage,
  unit,
}: {
  title: string;
  icon: any;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  unit: string;
}) {
  const isReached = limit > 0 && used >= limit;
  const isApproaching = limit > 0 && percentage >= 80 && !isReached;

  return (
    <div className="p-4 rounded-xl border bg-card/60 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {limit === -1 || limit === 0 ? 'Unlimited available' : `${used.toLocaleString()} of ${limit.toLocaleString()} ${unit} used`}
            </p>
          </div>
        </div>
        {limit > 0 && (
          <Badge
            variant={isReached ? 'destructive' : isApproaching ? 'outline' : 'secondary'}
            className="text-[10px] font-mono h-5 px-1.5"
          >
            {isReached ? 'Exhausted' : `${remaining.toLocaleString()} left`}
          </Badge>
        )}
      </div>

      {limit > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isReached ? 'bg-destructive' : isApproaching ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
            <span>{percentage.toFixed(0)}% utilized</span>
            <span>Max: {limit.toLocaleString()}</span>
          </div>
        </div>
      )}
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
          durationMonths: 1,
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
    [selectedCurrency]
  );

  // Synchronize modal pricing with global header currency selection
  useEffect(() => {
    if (selectedCheckoutPlan) {
      recalculateCheckoutPrice(selectedCheckoutPlan.id, appliedCoupon, selectedCurrency);
    }
  }, [selectedCurrency, selectedCheckoutPlan, appliedCoupon, recalculateCheckoutPrice]);

  // Handle opening checkout modal
  const handleOpenCheckout = (targetPlan: SubscriptionPlan) => {
    setSelectedCheckoutPlan(targetPlan);
    setEnableAutopay(true);
    setCouponInput('');
    setAppliedCoupon(null);
    setCouponError(null);
    setMockOrderPayload(null);
    recalculateCheckoutPrice(targetPlan.id, null, selectedCurrency);
  };

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
        autopay: enableAutopay,
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
        name: 'WACRM',
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

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Subscription & Billing"
        description="Manage your active subscription plan, entitlements, and Autopay billing settings."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await refresh();
              await fetchPlans();
              await fetchOrders();
              toast.success('Billing state refreshed');
            }}
            disabled={isLoading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Expiration Alert */}
          {(!isValid || isExpired) && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm font-semibold">Subscription Inactive</AlertTitle>
              <AlertDescription className="text-xs">
                Your subscription has expired or is not active. Select a plan below to activate workspace capabilities.
              </AlertDescription>
            </Alert>
          )}

          {/* 1. Current Plan & Quota Usage Overview */}
          <Card className="border shadow-2xs rounded-2xl overflow-hidden bg-card">
            <CardHeader className="p-6 pb-4 border-b bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="outline" className="px-2 py-0.5 text-xs font-bold bg-primary/10 text-primary border-primary/20">
                      Current Plan
                    </Badge>
                    <span className="text-xl font-black tracking-tight text-foreground">
                      {plan?.title || 'No Plan Active'}
                    </span>
                    {Number(plan?.is_trial) === 1 && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
                        Free Trial
                      </Badge>
                    )}
                    {autopayState.isActive && (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        Autopay Active
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    {plan?.short_description || 'Active subscription governing your workspace feature limits and permissions.'}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-foreground">
                      {isExpired ? (
                        <span className="text-destructive font-bold">Expired</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Calendar className="h-3 w-3" />
                      {planDetails?.plan_expire
                        ? `Expires: ${new Date(Number(planDetails.plan_expire)).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} (${daysLeft} days)`
                        : 'Lifetime / No Expiration'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {autopayState.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelAutopay}
                        disabled={isCancellingAutopay}
                        className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                      >
                        <ShieldX className="h-3.5 w-3.5" />
                        {isCancellingAutopay ? 'Cancelling...' : 'Cancel Autopay'}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        const el = document.getElementById('available-plans-section');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="gap-1.5 text-xs shadow-2xs font-semibold"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Manage Plan
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <QuotaCard
                  title="Contacts Storage Quota"
                  icon={Users}
                  used={contactsUsage.used}
                  limit={contactsUsage.limit}
                  remaining={contactsUsage.remaining}
                  percentage={contactsUsage.percentage}
                  unit="contacts"
                />
                <QuotaCard
                  title="WhatsApp QR Accounts Quota"
                  icon={QrCode}
                  used={qrAccountsUsage.used}
                  limit={qrAccountsUsage.limit}
                  remaining={qrAccountsUsage.remaining}
                  percentage={qrAccountsUsage.percentage}
                  unit="instances"
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. Available Plans Section (Direct Subscription without month pills) */}
          <div id="available-plans-section" className="space-y-5 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Available Subscription Plans</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a plan to subscribe with instant activation and seamless Autopay renewal.
                </p>
              </div>

              {/* Active Currency Badge synced with Header */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border text-xs font-mono text-muted-foreground self-start sm:self-auto shadow-2xs">
                <Globe className="h-3 w-3 text-primary" />
                <span>Prices in <strong className="text-foreground">{currencySymbol} {selectedCurrency}</strong></span>
                {isAutoDetected && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                    Auto-detected {detectedCountry ? `(${detectedCountry})` : ''}
                  </Badge>
                )}
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed text-muted-foreground text-xs">
                No active purchasable plans found. Please contact workspace administrator.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const isCurrent = plan?.id === p.id;
                  const explicitPrice = (p as any).currencyPrices?.[selectedCurrency];
                  const price = explicitPrice !== undefined ? Number(explicitPrice) : Math.round(Number(p.price || 0) * activeCurrencyRate * 100) / 100;
                  const explicitStrike = (p as any).currencyStrikePrices?.[selectedCurrency];
                  const strikePrice = explicitStrike !== undefined ? Number(explicitStrike) : (p.price_strike ? Math.round(Number(p.price_strike) * activeCurrencyRate * 100) / 100 : null);

                  return (
                    <Card
                      key={p.id}
                      className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isCurrent
                          ? 'border-primary ring-1 ring-primary/30 shadow-md bg-card'
                          : 'border-border hover:border-border/80 hover:shadow-sm bg-card/60'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-bl-xl shadow-2xs flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Current Plan
                        </div>
                      )}

                      <div className="p-5 space-y-4">
                        <div className="space-y-1 pr-14">
                          <h4 className="text-base font-bold text-foreground">{p.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                            {p.short_description || 'High-capacity WhatsApp CRM tools and feature suite.'}
                          </p>
                        </div>

                        {/* Plan Price */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-3xl font-black tracking-tight text-foreground font-mono">
                              {formatCurrencyAmount(price, selectedCurrency, currencySymbol)}
                            </span>
                            {strikePrice && strikePrice > price && (
                              <span className="text-sm font-semibold text-muted-foreground line-through font-mono">
                                {formatCurrencyAmount(strikePrice, selectedCurrency, currencySymbol)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground font-normal">
                              / {p.plan_duration_in_days || 30} days
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Repeat className="h-3 w-3 text-primary" />
                            Supports Razorpay Autopay (Cancel anytime)
                          </p>
                        </div>

                        {/* Core Quotas Checklist */}
                        <div className="space-y-2 pt-2 border-t text-xs">
                          <div className="flex items-center gap-2 text-foreground font-medium">
                            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>
                              {Number(p.contact_limit || 0) === 0
                                ? 'Unlimited Contacts'
                                : `${Number(p.contact_limit || 0).toLocaleString()} Contacts limit`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-foreground font-medium">
                            <QrCode className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{p.qr_account || 1} WhatsApp QR Instance(s)</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {Number(p.allow_chatbot) === 1 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            <span className={Number(p.allow_chatbot) === 1 ? 'text-foreground' : ''}>
                              Automated Chatbots & Flows
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {Number(p.allow_api) === 1 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            <span className={Number(p.allow_api) === 1 ? 'text-foreground' : ''}>
                              Developer REST API
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 pt-0">
                        <Button
                          variant={isCurrent ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleOpenCheckout(p)}
                          className="w-full text-xs font-semibold gap-1.5 shadow-2xs"
                        >
                          {isCurrent ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              Renew / Autopay {p.title}
                            </>
                          ) : (
                            <>
                              <Zap className="h-3.5 w-3.5" />
                              Subscribe to {p.title}
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Included Features & Entitlements */}
          <div className="space-y-4 pt-2">
            <Card className="border shadow-2xs rounded-2xl overflow-hidden bg-card">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-bold text-foreground">
                    Included Features &amp; Entitlements
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Specific capabilities authorized by your active workspace subscription.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      name: 'Chatbot Automation',
                      description: 'Build interactive flows and automated conversational responders.',
                      enabled: hasFeature('chatbot'),
                    },
                    {
                      name: 'REST API Access',
                      description: 'Integrate external services and trigger outbound messages.',
                      enabled: hasFeature('api'),
                    },
                    {
                      name: 'Chat Tags',
                      description: 'Label, categorize, and organize contacts and chats with tags.',
                      enabled: hasFeature('tags'),
                    },
                    {
                      name: 'Chat Notes',
                      description: 'Add private internal notes to chat threads for team collaboration.',
                      enabled: hasFeature('notes'),
                    },
                    {
                      name: 'WhatsApp Warmer',
                      description: 'Warm up newly registered WhatsApp accounts automatically.',
                      enabled: hasFeature('wa_warmer'),
                    },
                    {
                      name: 'WhatsApp Forms',
                      description: 'Collect customer submissions via conversational forms.',
                      enabled: hasFeature('allow_wa_forms'),
                    },
                    {
                      name: 'REST API QR Sessions',
                      description: 'Programmatically create and control Baileys WhatsApp QR instances.',
                      enabled: hasFeature('rest_api_qr'),
                    },
                    {
                      name: 'Instagram Direct Inbox',
                      description: 'Receive and reply to Instagram DMs inside the unified inbox.',
                      enabled: hasFeature('instagram_inbox'),
                    },
                    {
                      name: 'Telegram Bot Inbox',
                      description: 'Manage Telegram messages and subscribers inside unified inbox.',
                      enabled: hasFeature('telegram_inbox'),
                    },
                  ].map((feat, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                        feat.enabled
                          ? 'bg-card border-border shadow-2xs'
                          : 'bg-muted/15 border-border/50 opacity-60'
                      }`}
                    >
                      {feat.enabled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <p className={`text-xs font-semibold ${feat.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {feat.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Payment & Billing History Section */}
          <div className="space-y-4 pt-2">
            <Card className="border shadow-2xs rounded-2xl overflow-hidden bg-card">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Billing &amp; Payment History
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Verified transactions and receipts for this workspace.
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchOrders}
                    disabled={isOrdersLoading}
                    className="h-8 text-xs gap-1.5 text-muted-foreground"
                  >
                    <RefreshCw className={`h-3 w-3 ${isOrdersLoading ? 'animate-spin' : ''}`} />
                    Refresh History
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isOrdersLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No billing transactions recorded yet. Completed purchases will be logged here with payment receipts.
                  </div>
                ) : (
                  <>
                    {/* Mobile Transaction Cards (md:hidden) */}
                    <div className="md:hidden divide-y divide-border">
                      {orders.map((ord) => {
                        const statusLower = ord.status?.toLowerCase();
                        return (
                          <div key={ord.id} className="p-3.5 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-semibold text-foreground text-sm block">
                                  {ord.planTitle}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {new Date(ord.createdAt).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-foreground text-sm block">
                                  {formatCurrencyAmount(ord.amount, ord.currency || selectedCurrency, currencySymbol)}
                                </span>
                                <Badge
                                  variant={
                                    statusLower === 'paid'
                                      ? 'default'
                                      : statusLower === 'failed'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                                    statusLower === 'paid'
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : ''
                                  }`}
                                >
                                  {ord.status}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {ord.paymentMode}
                                </Badge>
                                {ord.isAutopay && (
                                  <Badge className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold px-1 py-0">
                                    Autopay
                                  </Badge>
                                )}
                                {ord.couponCode && (
                                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                                    {ord.couponCode}
                                  </Badge>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                                {ord.orderId ? ord.orderId.slice(0, 14) + '...' : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="text-xs font-semibold">Date</TableHead>
                            <TableHead className="text-xs font-semibold">Plan</TableHead>
                            <TableHead className="text-xs font-semibold">Amount</TableHead>
                            <TableHead className="text-xs font-semibold">Payment Mode</TableHead>
                            <TableHead className="text-xs font-semibold">Coupon</TableHead>
                            <TableHead className="text-xs font-semibold">Status</TableHead>
                            <TableHead className="text-xs font-semibold">Reference ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.map((ord) => {
                            const statusLower = ord.status?.toLowerCase();
                            return (
                              <TableRow key={ord.id} className="text-xs">
                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                  {new Date(ord.createdAt).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </TableCell>
                                <TableCell className="font-semibold text-foreground">
                                  {ord.planTitle}
                                </TableCell>
                                <TableCell className="font-mono font-bold text-foreground">
                                  {formatCurrencyAmount(ord.amount, ord.currency || selectedCurrency, currencySymbol)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                      {ord.paymentMode}
                                    </Badge>
                                    {ord.isAutopay && (
                                      <Badge className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold px-1 py-0">
                                        Autopay
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {ord.couponCode ? (
                                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                                      {ord.couponCode} (-{currencySymbol}{ord.couponDiscount})
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground/60">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      statusLower === 'paid'
                                        ? 'default'
                                        : statusLower === 'failed'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className={`text-[10px] uppercase font-bold ${
                                      statusLower === 'paid'
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : ''
                                    }`}
                                  >
                                    {ord.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-[11px] text-muted-foreground">
                                  {ord.orderId ? ord.orderId.slice(0, 16) + '...' : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* CHECKOUT MODAL                                                            */}
          {/* ========================================================================= */}
          <Dialog
            open={!!selectedCheckoutPlan}
            onOpenChange={(open) => {
              if (!open && !isProcessingPayment) {
                setSelectedCheckoutPlan(null);
                setMockOrderPayload(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border bg-background shadow-2xl">
              {/* Premium Gradient Header */}
              <div className="relative p-6 pb-4 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shadow-xs border border-primary/20 shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <span>Subscribe to {selectedCheckoutPlan?.title}</span>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Confirm your plan details and activate your workspace capabilities.
                      </DialogDescription>
                    </div>
                  </div>

                  {selectedCheckoutPlan && (
                    <Badge variant="outline" className="bg-background/80 backdrop-blur-xs font-mono font-bold text-xs px-2.5 py-1 text-primary border-primary/30 shrink-0">
                      {formatCurrencyAmount(priceSummary?.finalAmount !== undefined ? priceSummary.finalAmount : ((selectedCheckoutPlan as any).currencyPrices?.[selectedCurrency] ?? Number(selectedCheckoutPlan.price) * activeCurrencyRate), selectedCurrency, currencySymbol)}
                    </Badge>
                  )}
                </div>
              </div>

              {selectedCheckoutPlan && (
                <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                  {/* Selected Plan Overview Card */}
                  <div className="p-4 rounded-xl border bg-card/60 relative overflow-hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {selectedCheckoutPlan.title} Tier
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-primary/10 text-primary border-primary/20">
                            {selectedCheckoutPlan.plan_duration_in_days || 30} Days Validity
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {selectedCheckoutPlan.short_description || "Full-featured WhatsApp marketing and team inbox access."}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-foreground font-mono">
                          {formatCurrencyAmount(priceSummary?.finalAmount !== undefined ? priceSummary.finalAmount : ((selectedCheckoutPlan as any).currencyPrices?.[selectedCurrency] ?? Number(selectedCheckoutPlan.price) * activeCurrencyRate), selectedCurrency, currencySymbol)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {priceSummary?.currency || selectedCurrency} / cycle
                        </span>
                      </div>
                    </div>

                    {/* Key Entitlements Matrix Pills */}
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                        Included Quotas & Capabilities
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>{Number(selectedCheckoutPlan.contact_limit || 0) === 0 ? "Unlimited" : Number(selectedCheckoutPlan.contact_limit).toLocaleString()} Contacts</span>
                        </div>
                        <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span>{selectedCheckoutPlan.qr_account || 1} QR WhatsApp {Number(selectedCheckoutPlan.qr_account) === 1 ? "Account" : "Accounts"}</span>
                        </div>
                        {Boolean(selectedCheckoutPlan.allow_chatbot) && (
                          <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>Visual Chatbot</span>
                          </div>
                        )}
                        {Boolean(selectedCheckoutPlan.allow_api) && (
                          <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>REST API & Webhooks</span>
                          </div>
                        )}
                        {Boolean(selectedCheckoutPlan.wa_warmer) && (
                          <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>WA Warmer</span>
                          </div>
                        )}
                        {Boolean(selectedCheckoutPlan.allow_wa_forms) && (
                          <div className="px-2 py-1 rounded-md bg-muted/60 border text-[11px] font-medium flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span>Lead Forms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billing Mode: Autopay vs One-Time Interactive Cards */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Repeat className="h-3 w-3 text-primary" />
                      Select Billing Frequency
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div
                        onClick={() => setEnableAutopay(true)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          enableAutopay
                            ? "border-primary bg-primary/5 shadow-2xs"
                            : "border-border/60 hover:border-primary/40 bg-card/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Repeat className={`h-4 w-4 ${enableAutopay ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="font-bold text-xs text-foreground">Recurring Autopay</span>
                          </div>
                          <Badge className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20 text-[9px] px-1.5 py-0 font-semibold">
                            Recommended
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Renews automatically every {selectedCheckoutPlan.plan_duration_in_days || 30} days. Cancel anytime in 1-click.
                        </p>
                      </div>

                      <div
                        onClick={() => setEnableAutopay(false)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          !enableAutopay
                            ? "border-primary bg-primary/5 shadow-2xs"
                            : "border-border/60 hover:border-primary/40 bg-card/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard className={`h-4 w-4 ${!enableAutopay ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="font-bold text-xs text-foreground">One-Time Payment</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Pay once for this cycle only. Manually renew before expiry to maintain access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Tag className="h-3 w-3 text-primary" />
                      Promo Code or Coupon
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="e.g. WELCOME10, SAVE50"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          disabled={!!appliedCoupon || isApplyingCoupon || isCalculatingPrice}
                          className="h-9 text-xs font-mono uppercase pl-3 pr-8"
                        />
                      </div>
                      {appliedCoupon ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveCoupon}
                          className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 px-3"
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleApplyCoupon}
                          disabled={!couponInput.trim() || isApplyingCoupon || isCalculatingPrice}
                          className="h-9 text-xs font-semibold px-4"
                        >
                          {isApplyingCoupon ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Coupon status badges */}
                    {appliedCoupon && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Coupon &quot;{appliedCoupon}&quot; applied successfully</span>
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          -{formatCurrencyAmount(priceSummary?.couponDiscount, selectedCurrency, currencySymbol)}
                        </span>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-[11px] text-destructive flex items-center gap-1 pt-0.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {couponError}
                      </p>
                    )}
                  </div>

                  {/* Server Authoritative Price Breakdown */}
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Base Plan Price:</span>
                      <span className="font-mono text-foreground font-medium">
                        {formatCurrencyAmount(priceSummary?.baseSubtotal !== undefined ? priceSummary.baseSubtotal : (Number(selectedCheckoutPlan.price) * activeCurrencyRate), selectedCurrency, currencySymbol)}
                      </span>
                    </div>

                    {(priceSummary?.couponDiscount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Coupon Discount:</span>
                        <span className="font-mono font-semibold">
                          -{formatCurrencyAmount(priceSummary?.couponDiscount, selectedCurrency, currencySymbol)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-muted-foreground">
                      <span>Tax & Gateway Surcharges:</span>
                      <span className="font-mono text-foreground">Included (0%)</span>
                    </div>

                    <div className="pt-3 border-t border-border/80 flex justify-between items-baseline">
                      <div>
                        <span className="text-sm font-bold text-foreground block">Total Payable</span>
                        <span className="text-[10px] text-muted-foreground">
                          {enableAutopay ? "Auto-renews at end of cycle" : "Single billing cycle"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-primary font-mono tracking-tight">
                          {formatCurrencyAmount(priceSummary?.finalAmount !== undefined ? priceSummary.finalAmount : ((selectedCheckoutPlan as any).currencyPrices?.[selectedCurrency] ?? Number(selectedCheckoutPlan.price) * activeCurrencyRate), selectedCurrency, currencySymbol)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {priceSummary?.currency || selectedCurrency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trust & Security Badges Row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground p-2.5 rounded-xl bg-muted/30 border">
                    <div className="flex flex-col items-center gap-1">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      <span>256-Bit SSL</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Razorpay Verified</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>Instant Access</span>
                    </div>
                  </div>

                  {/* Dev Sandbox simulation box if keys are in mock mode */}
                  {mockOrderPayload && (
                    <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        <Info className="h-4 w-4 shrink-0" />
                        Sandbox / Dev Mode Testing Active
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Backend detected test Razorpay mode ({mockOrderPayload.isAutopay ? "Autopay Subscription" : "One-time Order"}). Test complete verification:
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleSimulateMockVerification(false)}
                          disabled={isProcessingPayment}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-1 font-semibold"
                        >
                          <Check className="h-3 w-3" />
                          Simulate Verified Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSimulateMockVerification(true)}
                          disabled={isProcessingPayment}
                          className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          Fake Signature
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="p-4 px-6 border-t bg-muted/20 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCheckoutPlan(null);
                    setMockOrderPayload(null);
                  }}
                  disabled={isProcessingPayment}
                  className="text-xs h-9 w-full sm:w-auto touch-manipulation"
                >
                  Cancel
                </Button>

                {!mockOrderPayload && (
                  <Button
                    size="sm"
                    onClick={handleProceedPayment}
                    disabled={isProcessingPayment || isCalculatingPrice}
                    className="text-xs font-bold gap-2 px-6 h-9 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto touch-manipulation"
                  >
                    {isProcessingPayment ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        {paymentStatusText || "Processing..."}
                      </>
                    ) : (
                      <>
                        {enableAutopay ? <Repeat className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                        <span>
                          {enableAutopay ? "Subscribe with Autopay • " : "Pay & Activate • "}
                          {currencySymbol}
                          {formatCurrencyAmount(priceSummary?.finalAmount !== undefined ? priceSummary.finalAmount : (selectedCheckoutPlan ? (Number(selectedCheckoutPlan.price) * activeCurrencyRate) : 0), selectedCurrency, currencySymbol)}
                        </span>
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>{/* ========================================================================= */}
          {/* PAYMENT SUCCESS DIALOG                                                    */}
          {/* ========================================================================= */}
          <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
            <DialogContent className="sm:max-w-md p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-8 ring-emerald-500/5">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <DialogTitle className="text-lg font-bold text-foreground">
                  {successReceipt?.isAutopay ? 'Autopay Subscription Activated!' : 'Payment Verified Successfully!'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Your workspace subscription has been updated and capabilities are active immediately.
                </DialogDescription>
              </div>

              {successReceipt && (
                <div className="p-4 rounded-xl border bg-muted/30 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activated Plan:</span>
                    <strong className="text-foreground">{successReceipt.planTitle}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-mono font-bold text-foreground">{successReceipt.amount}</span>
                  </div>
                  {successReceipt.isAutopay && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Billing Model:</span>
                      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                        Autopay (Auto-renewing)
                      </Badge>
                    </div>
                  )}
                  {successReceipt.newExpiry && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Validity:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {new Date(Number(successReceipt.newExpiry)).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {successReceipt.orderId.slice(0, 18)}...
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="justify-center sm:justify-center">
                <Button
                  size="sm"
                  onClick={() => setSuccessDialogOpen(false)}
                  className="w-full text-xs font-semibold"
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
