import React from 'react';
import type { Metadata } from 'next';
import { MarketingHowItWorks } from '@/components/marketing/how-it-works';
import { CompetitorComparison } from '@/components/marketing/competitor-comparison';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { getPlanOffers, toAggregateOffer } from '@/lib/seo/plan-offers';
import { siteConfig } from '@/config/site';
import { lpDisplay } from '@/components/marketing/landing/fonts';
import { SmoothScroll } from '@/components/marketing/landing/smooth-scroll';
import { LandingNav } from '@/components/marketing/landing/landing-nav';
import { HeroDesk } from '@/components/marketing/landing/hero-desk';
import { MessageJourney } from '@/components/marketing/landing/message-journey';
import { FinalCta } from '@/components/marketing/landing/final-cta';

export const metadata: Metadata = {
  title: {
    absolute: 'Resend — WhatsApp Business API, CRM & Automation',
  },
  description:
    'Manage WhatsApp Business messaging, customer conversations, campaigns and automation with Resend. Connect your business workflows through one platform.',
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    title: 'Resend — WhatsApp Business API, CRM & Automation',
    description:
      'Manage WhatsApp Business messaging, customer conversations, campaigns and automation with Resend. Connect your business workflows through one platform.',
    url: 'https://resend.in',
    siteName: siteConfig.name,
    images: [
      {
        url: '/newog.png',
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
    images: ['/newog.png'],
  },
};

export default async function HomePage() {
  const planOffers = await getPlanOffers();
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
        // Prices come from the live plan table; omitted if plans couldn't be loaded
        ...(planOffers ? { offers: toAggregateOffer(planOffers) } : {}),
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
              text: 'With the Meta Cloud API, message fees are billed directly by Meta at its current published rates. QR connections send messages through your own WhatsApp number and do not incur Meta API fees.',
            },
          },
        ],
      },
    ],
  };

  return (
    <SmoothScroll>
      <div
        className={`lp ${lpDisplay.variable} flex min-h-screen flex-col selection:bg-primary/20 selection:text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <LandingNav />

        <main className="flex-1 pb-16 sm:pb-0">
          <HeroDesk />
          <MessageJourney />
          <MarketingHowItWorks />
          <CompetitorComparison />
          <MarketingPricing />
          <MarketingFAQ />
          <FinalCta />
        </main>

        <StickyMobileCTA />
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}
