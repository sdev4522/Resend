'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CircleCheck, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { billingApi } from '@/lib/api/billing';
import { savePricingChoice, billingCheckoutHref } from '@/lib/billing/pricing-choice';
import { SubscriptionPlan } from '@/types/billing';

export function MarketingPricing({ isPageHeading = false }: { isPageHeading?: boolean } = {}) {
  const { user } = useAuth();
  const { openRegister } = useAuthDialog();

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [durationDiscounts, setDurationDiscounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await billingApi.getPlans();
      if (res.success && Array.isArray(res.plans)) {
        // Filter out any explicitly disabled or private plans if present, while preserving all public plans including the trial plan
        const visiblePlans = res.plans.filter((p: any) => {
          if (p.is_active === false || p.is_active === 0) return false;
          if (p.status === 'inactive' || p.status === 'disabled' || p.status === 'archived') return false;
          if (p.is_private === true || p.is_private === 1) return false;
          return true;
        });
        setPlans(visiblePlans);
        if (res.currency) setCurrency(res.currency);
        if (res.currencySymbol) setCurrencySymbol(res.currencySymbol);
        if (res.durationDiscounts) setDurationDiscounts(res.durationDiscounts);
      } else {
        setError('Subscription plans are currently being updated. Please check back shortly.');
      }
    } catch {
      setError('Unable to load real-time plan pricing from the server. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Backend authoritative annual discount (e.g. 15% from DURATION_DISCOUNT_RATES[12])
  const annualDiscountPercent = Math.round((durationDiscounts['12'] || 0.15) * 100);

  const formatPrice = (amount: number) => {
    if (currency === 'INR') {
      return `${currencySymbol}${Math.round(amount).toLocaleString('en-IN')}`;
    }
    return `${currencySymbol}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
  };

  const getPlanFeatureList = (p: SubscriptionPlan): string[] => {
    const features: string[] = [];

    // WhatsApp instances
    const qrCount = Number(p.qr_account || 1);
    features.push(
      qrCount > 1
        ? `${qrCount} WhatsApp numbers`
        : '1 WhatsApp number'
    );

    // Multi-agent Inbox
    features.push('Shared team inbox');

    // Contacts
    if (p.contact_limit) {
      features.push(`${Number(p.contact_limit).toLocaleString('en-IN')} contacts`);
    } else {
      features.push('Unlimited contacts');
    }

    // Chatbot / Automation
    if (Number(p.allow_chatbot) > 0) {
      features.push('Chatbots and keyword replies');
    }

    // Developer API
    if (Number(p.allow_api) > 0 || Number(p.rest_api_qr) > 0) {
      features.push('REST API and webhooks');
    }

    // Tags & Notes
    if (Number(p.allow_tag) > 0 || Number(p.allow_note) > 0) {
      features.push('Labels and private notes');
    }

    // Warmer
    if (Number(p.wa_warmer) > 0) {
      features.push('Number warm-up');
    }

    // Addons
    if (Number(p.instagram_inbox) > 0) {
      features.push('Instagram DMs in the inbox');
    }
    if (Number(p.telegram_inbox) > 0) {
      features.push('Telegram in the inbox');
    }
    if (Number(p.allow_wa_forms) > 0) {
      features.push('WhatsApp forms');
    }

    return features;
  };

  return (
    <div id="pricing" className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto">
        {isPageHeading ? (
          <h1 className="lp-section-title text-balance text-4xl md:text-[3.25rem] text-foreground">Pricing that grows with your team</h1>
        ) : (
          <h2 className="lp-section-title text-balance text-4xl md:text-[3.25rem] text-foreground">Pricing that grows with your team</h2>
        )}
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Every plan includes the shared inbox, team seats, contacts and automation. Start with 14 days free, no card
          needed.
        </p>

        {/* Toggle */}
        <div className="mt-8 flex justify-center">
          <Tabs
            value={billingPeriod}
            onValueChange={(val) => setBillingPeriod(val as 'monthly' | 'yearly')}
            className="w-auto"
          >
            <TabsList className="h-11 px-1.5 rounded-full bg-muted/80 border border-border/60">
              <TabsTrigger value="monthly" className="py-1.5 px-5 rounded-full text-xs sm:text-sm font-medium">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="yearly" className="py-1.5 px-5 rounded-full text-xs sm:text-sm font-medium">
                Yearly
                {annualDiscountPercent > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Save {annualDiscountPercent}%
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Pricing Cards Container */}
      <div className="mt-12 w-full max-w-6xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/60 p-6 sm:p-8 space-y-6 bg-card/40">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-14 w-full" />
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center max-w-lg mx-auto">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">Real-time Pricing Unavailable</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPlans} className="mt-4 gap-2">
              <RefreshCw className="h-4 w-4" /> Retry Loading Plans
            </Button>
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center max-w-lg mx-auto">
            <h3 className="text-base font-semibold text-foreground">No Public Plans Available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please contact our sales team for enterprise plan configurations.
            </p>
            <Button size="sm" render={<Link href="/contact" />} className="mt-4">
              Contact Sales
            </Button>
          </div>
        ) : (
          <div
            className={`grid gap-6 sm:gap-8 items-stretch ${plans.length === 1
              ? 'grid-cols-1 max-w-md mx-auto'
              : plans.length === 2
                ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                : plans.length === 3
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto'
              }`}
          >
            {plans.map((plan, index) => {
              const isTrial = Boolean(plan.is_trial === 1 || plan.is_trial || String(plan.title || '').toLowerCase().includes('trial'));
              // Calculate monthly vs annual amounts
              const basePrice = plan.currencyPrices?.[currency] ?? plan.price;
              const strikePrice = plan.currencyStrikePrices?.[currency] ?? (plan.price_strike ? parseFloat(plan.price_strike) : null);
              const isAnnualPlan = Number(plan.plan_duration_in_days) >= 365;

              // Price shown in the unit the customer actually pays. Year-long plans are always
              // shown per year; monthly plans show the discounted 12-month total under "Yearly",
              // which is exactly what checkout charges (durationMonths: 12).
              let displayMonthlyPrice: number;
              let priceUnit: string;
              let billingSummary: string;
              let checkoutMonths: 1 | 12 = 1;

              if (isTrial) {
                displayMonthlyPrice = 0;
                priceUnit = `/ ${plan.plan_duration_in_days || 14} days`;
                billingSummary = 'No card needed';
              } else if (isAnnualPlan) {
                displayMonthlyPrice = basePrice;
                priceUnit = '/ year';
                billingSummary = `Works out to ${formatPrice(basePrice / 12)} a month, paid once a year`;
              } else if (billingPeriod === 'yearly') {
                const discountRate = durationDiscounts['12'] || 0.15;
                const discountedAnnual = Math.round(basePrice * 12 * (1 - discountRate));
                displayMonthlyPrice = discountedAnnual;
                priceUnit = '/ year';
                billingSummary = `${formatPrice(discountedAnnual / 12)} a month, paid once a year`;
                checkoutMonths = 12;
              } else {
                displayMonthlyPrice = basePrice;
                priceUnit = '/ month';
                billingSummary = 'Billed monthly, cancel anytime';
              }
              // Strike price is stored per plan term; scale it to the unit shown
              const shownStrike =
                strikePrice && !isAnnualPlan && checkoutMonths === 12 ? strikePrice * 12 : strikePrice;

              const features = getPlanFeatureList(plan);
              const isHighlighted = Boolean(plan.is_popular || (!isTrial && (plans.length > 2 ? index === 1 : index === plans.length - 1)));

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 ${isHighlighted
                    ? 'border-2 border-primary bg-card/90 shadow-xl shadow-primary/5'
                    : 'border border-border/70 bg-card hover:border-foreground/30'
                    }`}
                >
                  {isHighlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-1 shadow-sm gap-1 text-[11px]">
                        <Sparkles className="h-3 w-3" /> Most Popular
                      </Badge>
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground tracking-tight">
                        {plan.title}
                      </h3>
                      <Badge
                        variant={isTrial ? "outline" : "secondary"}
                        className={`text-[11px] font-medium ${isTrial
                          ? "border-primary/40 text-primary bg-primary/10"
                          : ""
                          }`}
                      >
                        {isTrial ? `${plan.plan_duration_in_days || 14}-day trial` : isAnnualPlan ? 'Yearly plan' : 'Monthly plan'}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                      {plan.short_description ||
                        (isTrial
                          ? '14 days of full access to test WhatsApp team inbox, campaigns, and chatbot automation.'
                          : isAnnualPlan
                            ? 'High-volume tier for established businesses running multi-agent support and larger contact databases.'
                            : 'Standard tier for growing businesses managing customer conversations and broadcast campaigns.')}
                    </p>

                    {/* Price Block */}
                    <div className="mt-6 flex items-baseline gap-2">
                      {shownStrike && shownStrike > displayMonthlyPrice && !isTrial && (
                        <span className="mr-1 text-xl text-muted-foreground/60 line-through">
                          <span className="sr-only">Was </span>
                          {formatPrice(shownStrike)}
                        </span>
                      )}
                      <span className="lp-section-title text-4xl sm:text-5xl text-foreground">
                        {isTrial ? 'Free' : formatPrice(displayMonthlyPrice)}
                      </span>
                      <span className="text-sm text-muted-foreground">{priceUnit}</span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      {billingSummary}
                    </p>

                    {/* Features List */}
                    <div className="mt-8 border-t border-border/40 pt-6">
                      <span className="text-sm font-medium text-foreground/80">What&apos;s included</span>
                      <ul className="mt-4 space-y-3">
                        {features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                            <CircleCheck className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                            <span className="leading-tight">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA Action */}
                  <div className="mt-8 pt-6 border-t border-border/40">
                    {user ? (
                      isTrial ? (
                        <Button
                          variant="outline"
                          className="w-full rounded-xl h-11 text-sm font-semibold gap-2 border-border/80 hover:border-foreground/40"
                          render={<Link href="/dashboard" />}
                        >
                          Open dashboard
                        </Button>
                      ) : (
                        <Button
                          variant={isHighlighted ? 'default' : 'outline'}
                          className="w-full rounded-xl h-11 text-sm font-semibold gap-2"
                          render={<Link href={billingCheckoutHref({ planId: Number(plan.id), durationMonths: checkoutMonths })} />}
                        >
                          Choose {plan.title}
                        </Button>
                      )
                    ) : (
                      <Button
                        variant={isHighlighted ? 'default' : 'outline'}
                        className={`w-full rounded-xl h-11 text-sm font-semibold gap-2 ${isTrial ? 'border-primary/50 text-foreground hover:bg-primary/10' : ''
                          }`}
                        onClick={() => {
                          // remember the pick so onboarding preselects this plan and term
                          if (!isTrial) savePricingChoice({ planId: Number(plan.id), durationMonths: checkoutMonths });
                          openRegister();
                        }}
                      >
                        {isTrial ? 'Start free trial' : `Start with ${plan.title}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Messaging Transparency Callout */}
      <div className="mt-12 w-full max-w-4xl mx-auto rounded-2xl border border-border/70 bg-card p-6 sm:p-7 text-xs text-muted-foreground leading-relaxed space-y-2.5">
        <h4 className="text-sm font-semibold text-foreground">
          What you pay Resend, and what you pay Meta
        </h4>
        <p>
          <strong className="text-foreground">Resend Platform Subscription:</strong> Covers your software license, shared team inbox seats, contact CRM, broadcast manager, automation flow builder, and developer API tools.
        </p>
        <p>
          <strong className="text-foreground">Meta Cloud API messages:</strong> When you connect through the official Cloud API, Meta bills message fees directly to your Meta Business account at{' '}
          <a href="https://developers.facebook.com/docs/whatsapp/pricing" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Meta&apos;s current rates
          </a>
          .
        </p>
        <p>
          <strong className="text-foreground">QR Device Connections:</strong> When connecting through our instant QR scan engine, messages are sent over your phone carrier or data plan without Meta conversation fees.
        </p>
      </div>

      {/* Trust & Enterprise Callout */}
      <div className="mt-16 w-full max-w-4xl mx-auto rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            Looking for Custom Volumes or Dedicated Infrastructure?
          </h4>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            We provide on-premise WhatsApp instances, high-throughput dedicated Cloud API throughput, and custom webhook SLAs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/contact" />}
          className="shrink-0 rounded-xl h-10 px-5"
        >
          Talk with Sales
        </Button>
      </div>
    </div>
  );
}
