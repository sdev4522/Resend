import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFeatures } from '@/components/marketing/features';
import { MarketingProductShowcase } from '@/components/marketing/product-showcase';
import { MarketingTrustBar } from '@/components/marketing/trust-bar';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Features — WhatsApp Cloud API, Inbox & Automation',
  description:
    'Explore official WhatsApp Cloud API broadcasting, visual no-code flow builder, multi-agent shared inbox, and developer APIs.',
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'Features — WhatsApp Cloud API, Inbox & Automation | Resend',
    description:
      'Explore official WhatsApp Cloud API broadcasting, visual no-code flow builder, multi-agent shared inbox, and developer APIs.',
    url: `${siteConfig.url}/features`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Resend Features — WhatsApp Automation & CRM',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features — WhatsApp Cloud API, Inbox & Automation | Resend',
    description:
      'Explore official WhatsApp Cloud API broadcasting, visual no-code flow builder, multi-agent shared inbox, and developer APIs.',
    images: ['/og.png'],
  },
};

export default function FeaturesPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
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
        name: 'Features',
        item: `${siteConfig.url}/features`,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MarketingNavbar />
      <main className="flex-1 pt-16 xs:pt-20 sm:pt-24 pb-16 sm:pb-0">
        <MarketingFeatures />
        <MarketingProductShowcase />
        <MarketingTrustBar />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
