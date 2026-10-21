import React from 'react';
import type { Metadata } from 'next';
import { MarketingCapabilityMarquee } from '@/components/marketing/capability-marquee';
import { MarketingBentoFeatures } from '@/components/marketing/bento-features';
import { MarketingHowItWorks } from '@/components/marketing/how-it-works';
import { MarketingFeatureComparison } from '@/components/marketing/feature-comparison';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { siteConfig } from '@/config/site';
import { Hero5 } from '@/components/ui/hero-5';

export const metadata: Metadata = {
  title: {
    absolute: 'Resend — WhatsApp Business API, CRM & Automation',
  },
  description:
    'Manage WhatsApp Business messaging, customer conversations, campaigns and automation with Resend. Connect your business workflows through one platform.',
  alternates: {
    canonical: 'https://resend.in',
  },
  openGraph: {
    title: 'Resend — WhatsApp Business API, CRM & Automation',
    description:
      'Manage WhatsApp Business messaging, customer conversations, campaigns and automation with Resend. Connect your business workflows through one platform.',
    url: 'https://resend.in',
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Resend — WhatsApp Business API, CRM & Automation Platform',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resend — WhatsApp Business API, CRM & Automation',
    description:
      'Manage WhatsApp Business messaging, customer conversations, campaigns and automation with Resend. Connect your business workflows through one platform.',
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
          lowPrice: '0',
          highPrice: '10',
          offerCount: '3',
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
            name: 'How do I get started with Resend?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Getting started takes under 5 minutes. Sign up for a free 14-day trial, create your workspace, and connect your WhatsApp number via Meta Cloud API or QR engine.',
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
            name: 'What is the difference between Meta Cloud API and QR-based connections?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The Meta Cloud API connects directly through Meta’s servers for verified high-throughput messaging without phone dependency. The QR engine provides instant quick connection for existing numbers.',
            },
          },
          {
            '@type': 'Question',
            name: 'Are there additional charges from Meta for WhatsApp conversations?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'If using Meta Cloud API, WhatsApp conversation charges are billed directly by Meta according to their official conversation pricing. Meta provides 1,000 free service conversations per month per business portfolio. QR connections use your regular phone plan without Meta conversation fees.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20 selection:text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />



      <main className="flex-1 pb-16 sm:pb-0">
        {/* Section 2: Hero */}
        <Hero5 />

        {/* Section 3: Capability Marquee */}
        <MarketingCapabilityMarquee />

        {/* Section 4: Feature Bento Grid */}
        <MarketingBentoFeatures />

        {/* Section 5: How It Works */}
        <MarketingHowItWorks />

        {/* Section 6: Feature Comparison */}
        <MarketingFeatureComparison />

        {/* Section 7: Pricing Preview */}
        <MarketingPricing />

        {/* Section 8: FAQ */}
        <MarketingFAQ />

        {/* Section 9: Final CTA */}
        <MarketingCTABanner />
      </main>

      {/* Mobile Sticky CTA Bar */}
      <StickyMobileCTA />

      {/* Section 10: Footer */}
      <MarketingFooter />
    </div>
  );
}
