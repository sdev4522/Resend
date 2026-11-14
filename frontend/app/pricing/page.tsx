import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { PageBreadcrumb } from '@/components/marketing/page-breadcrumb';
import { siteConfig } from '@/config/site';
import { getPlanOffers, toAggregateOffer } from '@/lib/seo/plan-offers';

export const metadata: Metadata = {
  title: 'Pricing — Transparent WhatsApp CRM Plans',
  description:
    'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands with zero message markups.',
  keywords: [
    'WhatsApp Business API pricing',
    'WhatsApp CRM cost',
    'WhatsApp marketing plans',
    'Meta conversation pricing 2026',
    'Free WhatsApp CRM trial',
    'No credit card WhatsApp trial',
    'WATI pricing alternative',
    'AiSensy pricing alternative',
  ],
  alternates: {
    canonical: `${siteConfig.url}/pricing`,
  },
  openGraph: {
    title: 'Pricing — Transparent WhatsApp CRM Plans | Resend',
    description:
      'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands with zero message markups.',
    url: `${siteConfig.url}/pricing`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/newog.png',
        width: 1200,
        height: 630,
        alt: 'Resend Pricing Plans',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Transparent WhatsApp CRM Plans | Resend',
    description:
      'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands with zero message markups.',
    images: ['/newog.png'],
  },
};

export default async function PricingPage() {
  const planOffers = await getPlanOffers();
  const pricingJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteConfig.url,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Pricing',
            item: `${siteConfig.url}/pricing`,
          },
        ],
      },
      // Only publish prices we actually charge; skip the product node if plans couldn't be loaded
      ...(planOffers
        ? [
            {
              '@type': 'Product',
              name: `${siteConfig.name} subscription`,
              description: 'WhatsApp Business API, shared team inbox, chatbots and campaigns.',
              brand: { '@type': 'Brand', name: siteConfig.name },
              offers: toAggregateOffer(planOffers),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <MarketingNavbar />
      <main className="flex-1 pt-16 xs:pt-20 sm:pt-24 pb-16 sm:pb-0">
        <PageBreadcrumb items={[{ name: 'Pricing' }]} />
        <MarketingPricing isPageHeading />
        <MarketingFAQ />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
