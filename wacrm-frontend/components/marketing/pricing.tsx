'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CircleCheck, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { billingApi } from '@/lib/api/billing';
import { SubscriptionPlan } from '@/types/billing';

export function MarketingPricing() {
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
        // Exclude trial from main pricing cards if trial is separated, or include if active
        // Usually SaaS plans are active paid tiers (trial can be CTA)
        const visiblePlans = res.plans.filter((p) => !p.is_trial || p.price > 0);
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
        ? `${qrCount} Connected WhatsApp Numbers / Instances`
        : '1 Connected WhatsApp Number / Instance'
    );

    // Multi-agent Inbox
    features.push('Collaborative Multi-Agent Team Inbox');

    // Contacts
    if (p.contact_limit) {
      features.push(`${Number(p.contact_limit).toLocaleString()} Contacts Storage Limit`);
    } else {
      features.push('Unlimited Contacts Directory');
    }

    // Chatbot / Automation
    if (Number(p.allow_chatbot) > 0) {
      features.push('Automated Chatbot Rules & Keywords');
    }

    // Developer API
    if (Number(p.allow_api) > 0 || Number(p.rest_api_qr) > 0) {
      features.push('Developer REST API & Inbound Webhooks');
    }

    // Tags & Notes
    if (Number(p.allow_tag) > 0 || Number(p.allow_note) > 0) {
      features.push('Contact Segmentation, Tags & Agent Notes');
    }

    // Warmer
    if (Number(p.wa_warmer) > 0) {
      features.push('Official WhatsApp Account Warmer');
    }

    // Addons
    if (Number(p.instagram_inbox) > 0) {
      features.push('Instagram Direct Shared Inbox');
    }
    if (Number(p.telegram_inbox) > 0) {
      features.push('Telegram Bot Messaging Inbox');
    }
    if (Number(p.allow_wa_forms) > 0) {
      features.push('Interactive WhatsApp Form Builder');
    }

    return features;
  };

  return (
    <div id="pricing" className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto">
        <Badge variant="outline" className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3">
          Authoritative SaaS Billing
        </Badge>
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Predictable Pricing. Zero Hidden Fees.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Powered directly by our production billing engine. Upgrade, downgrade, or adjust licenses anytime with full prorated balance management.
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
                Monthly Billing
              </TabsTrigger>
              <TabsTrigger value="yearly" className="py-1.5 px-5 rounded-full text-xs sm:text-sm font-medium">
                Annual Billing
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {plans.map((plan, index) => {
              // Calculate monthly vs annual amounts
              const basePrice = plan.currencyPrices?.[currency] ?? plan.price;
              const strikePrice = plan.currencyStrikePrices?.[currency] ?? (plan.price_strike ? parseFloat(plan.price_strike) : null);
              const isAnnualPlan = Number(plan.plan_duration_in_days) >= 365;

              let displayMonthlyPrice: number;
              let billingSummary: string;

              if (billingPeriod === 'yearly') {
                if (isAnnualPlan) {
                  // Plan is natively annual
                  displayMonthlyPrice = Math.round((basePrice / 12) * 100) / 100;
                  billingSummary = `Billed annually (${formatPrice(basePrice)}/yr)`;
                } else {
                  // Plan is monthly, apply backend duration discount
                  const discountRate = durationDiscounts['12'] || 0.15;
                  const discountedAnnual = basePrice * 12 * (1 - discountRate);
                  displayMonthlyPrice = Math.round((discountedAnnual / 12) * 100) / 100;
                  billingSummary = `Billed annually (${formatPrice(Math.round(discountedAnnual))}/yr)`;
                }
              } else {
                if (isAnnualPlan) {
                  displayMonthlyPrice = Math.round((basePrice / 12) * 100) / 100;
                  billingSummary = `Annual commitment (${formatPrice(basePrice)}/yr)`;
                } else {
                  displayMonthlyPrice = basePrice;
                  billingSummary = 'Billed monthly, cancel anytime';
                }
              }

              const features = getPlanFeatureList(plan);
              const isHighlighted = index === 1 || plan.is_popular;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 ${
                    isHighlighted
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
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        {isAnnualPlan ? 'Annual' : 'Standard'}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[40px]">
                      {plan.short_description || 'Production-grade WhatsApp CRM & multi-agent automation platform.'}
                    </p>

                    {/* Price Block */}
                    <div className="mt-6 flex items-baseline gap-2">
                      {strikePrice && strikePrice > displayMonthlyPrice && (
                        <span className="line-through text-muted-foreground/50 text-xl font-mono mr-1">
                          {formatPrice(strikePrice)}
                        </span>
                      )}
                      <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground font-mono">
                        {formatPrice(displayMonthlyPrice)}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        / month
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      {billingSummary}
                    </p>

                    {/* Features List */}
                    <div className="mt-8 border-t border-border/40 pt-6">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                        Included Capabilities
                      </span>
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
                      <Button
                        variant={isHighlighted ? 'default' : 'outline'}
                        className="w-full rounded-xl h-11 text-sm font-semibold gap-2"
                        render={<Link href="/dashboard/billing" />}
                      >
                        Manage & Upgrade Plan <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant={isHighlighted ? 'default' : 'outline'}
                        className="w-full rounded-xl h-11 text-sm font-semibold gap-2"
                        onClick={openRegister}
                      >
                        Get Started <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
