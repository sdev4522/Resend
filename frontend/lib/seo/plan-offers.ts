import { siteConfig } from '@/config/site';

/**
 * Structured-data offers built from the live plan table, so search results never
 * show a price we don't charge. Server-only; cached for an hour.
 * Returns null when the API is unreachable: callers then omit offers entirely
 * rather than publishing a guessed price.
 */

const API_BASE_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Plans are sold in INR by default (the API's base currency)
const SEO_CURRENCY = 'INR';

interface ApiPlan {
  id: number;
  title: string;
  short_description?: string | null;
  price: number | string;
  is_trial: number;
  plan_duration_in_days: number | string;
  currencyPrices?: Record<string, number>;
}

export interface PlanOffer {
  name: string;
  description?: string;
  price: number;
  days: number;
  isTrial: boolean;
}

export async function getPlanOffers(): Promise<PlanOffer[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/billing/plans`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { plans?: ApiPlan[] };
    if (!data.plans?.length) return null;
    return data.plans.map((p) => ({
      name: p.title,
      description: p.short_description || undefined,
      price: Number(p.currencyPrices?.[SEO_CURRENCY] ?? p.price ?? 0),
      days: Number(p.plan_duration_in_days) || 30,
      isTrial: Number(p.is_trial) === 1,
    }));
  } catch {
    return null;
  }
}

const isoPeriod = (days: number) => (days >= 365 ? 'P1Y' : days >= 28 && days <= 31 ? 'P1M' : `P${days}D`);

/** Individual offers, each with its billing period (monthly and yearly plans are not comparable). */
export function toSchemaOffers(offers: PlanOffer[]) {
  return offers.map((o) => ({
    '@type': 'Offer',
    name: o.name,
    ...(o.description ? { description: o.description } : {}),
    price: o.price.toFixed(2),
    priceCurrency: SEO_CURRENCY,
    availability: 'https://schema.org/InStock',
    url: `${siteConfig.url}/pricing`,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: o.price.toFixed(2),
      priceCurrency: SEO_CURRENCY,
      billingDuration: isoPeriod(o.days),
    },
  }));
}

export function toAggregateOffer(offers: PlanOffer[]) {
  const prices = offers.map((o) => o.price);
  return {
    '@type': 'AggregateOffer',
    priceCurrency: SEO_CURRENCY,
    lowPrice: Math.min(...prices).toFixed(2),
    highPrice: Math.max(...prices).toFixed(2),
    offerCount: String(offers.length),
    offers: toSchemaOffers(offers),
  };
}
