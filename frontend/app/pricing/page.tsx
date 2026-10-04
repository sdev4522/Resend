import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pricing — Transparent WhatsApp CRM Plans',
  description:
    'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Pricing — Transparent WhatsApp CRM Plans | Resend',
    description:
      'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands.',
    url: `${siteConfig.url}/pricing`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
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
      'Simple, transparent plans for WhatsApp marketing, shared inbox seats, and automation workflows. Scale as your team expands.',
    images: ['/og.png'],
  },
};

export default function PricingPage() {
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
      {
        '@type': 'Product',
        name: 'WaCRM Platform Subscription',
        description: 'WhatsApp CRM, automation, and collaborative multi-agent inbox platform subscription plans',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '6',
          highPrice: '10',
          offerCount: '2',
          availability: 'https://schema.org/InStock',
          url: `${siteConfig.url}/pricing`,
        },
      },
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
        <MarketingPricing />
        <MarketingFAQ />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
