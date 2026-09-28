import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingTrustBar } from '@/components/marketing/trust-bar';
import { MarketingProductShowcase } from '@/components/marketing/product-showcase';
import { MarketingHowItWorks } from '@/components/marketing/how-it-works';
import { MarketingUseCases } from '@/components/marketing/use-cases';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: {
    absolute: 'WaCRM — WhatsApp CRM, Automation & Multi-Agent Inbox',
  },
  description:
    'Consolidate WhatsApp customer communication, marketing broadcasts, and team support into an all-in-one CRM platform with official Meta Cloud API.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'WaCRM — WhatsApp CRM, Automation & Multi-Agent Inbox',
    description:
      'Consolidate WhatsApp customer communication, marketing broadcasts, and team support into an all-in-one CRM platform.',
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'WaCRM — WhatsApp CRM, Automation & Multi-Agent Inbox',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WaCRM — WhatsApp CRM, Automation & Multi-Agent Inbox',
    description:
      'Consolidate WhatsApp customer communication, marketing broadcasts, and team support into an all-in-one CRM platform.',
    images: ['/og.png'],
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteConfig.url}/#software`,
        name: siteConfig.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice: '6',
          highPrice: '10',
          offerCount: '2',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/icon-512.png`,
        contactPoint: {
          '@type': 'ContactPoint',
          email: siteConfig.contactEmail,
          contactType: 'customer support',
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteConfig.url}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does the WhatsApp Cloud API integration work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'WaCRM integrates with Meta’s official Cloud API for enterprise messaging, and also supports QR-based connections for instant quick starts. You can connect your existing number without downtime.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can multiple agents respond from the same number?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Your entire team can log in simultaneously, view shared customer conversations, assign chats to specific agents, and collaborate seamlessly.',
            },
          },
          {
            '@type': 'Question',
            name: 'Will our WhatsApp number risk getting banned?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Using the official Meta Cloud API ensures 100% compliance with WhatsApp Business policies. Our built-in rate-limiting prevents anti-spam triggers.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingNavbar />
      <main className="flex-1 pt-16 xs:pt-20 sm:pt-24 pb-16 sm:pb-0">
        <MarketingHero />
        <MarketingTrustBar />
        <MarketingProductShowcase />
        <MarketingHowItWorks />
        <MarketingUseCases />
        <MarketingPricing />
        <MarketingFAQ />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
