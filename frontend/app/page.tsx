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
    'Official WhatsApp Business API platform and conversational CRM. Connect via Meta Cloud API or instant QR, manage chats with multi-agent shared team inbox, build visual automated flows, and broadcast marketing campaigns with 0% platform markup.',
  keywords: [
    'WhatsApp Business API',
    'WhatsApp CRM',
    'WhatsApp Automation Platform',
    'Meta Cloud API Provider',
    'WhatsApp Shared Team Inbox',
    'Multi-Agent WhatsApp Support',
    'WhatsApp Chatbot Visual Flow Builder',
    'Bulk WhatsApp Template Broadcasts',
    'WATI Alternative',
    'AiSensy Alternative',
    'Interakt Alternative',
    'WhatsApp Marketing Software',
    'WhatsApp Abandoned Cart Recovery',
    'WhatsApp Developer REST API',
  ],
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    title: 'Resend — WhatsApp Business API, CRM & Automation',
    description:
      'Official WhatsApp Business API platform and conversational CRM. Connect via Meta Cloud API or instant QR, manage chats with multi-agent shared team inbox, build visual automated flows, and broadcast marketing campaigns with 0% platform markup.',
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
      'Official WhatsApp Business API platform and conversational CRM. Connect via Meta Cloud API or instant QR, manage chats with multi-agent shared team inbox, build visual automated flows, and broadcast marketing campaigns with 0% platform markup.',
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
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteConfig.url}/features?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteConfig.url}/#software`,
        name: siteConfig.name,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'WhatsApp CRM & Marketing Automation',
        operatingSystem: 'All',
        featureList: [
          'Meta WhatsApp Cloud API Integration',
          'Instant QR Device Sync Engine',
          'Multi-Agent Shared Team Inbox with Real-Time Routing',
          'Visual No-Code Chatbot Flow Builder',
          'Bulk Segmented Template Broadcast Campaigns',
          'Contacts CRM with Tags & Custom Attributes',
          'Developer REST API & Bidirectional Webhooks',
          '7-Day Free Trial with No Credit Card Required',
        ],
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
        '@type': 'HowTo',
        '@id': `${siteConfig.url}/#howto-setup`,
        name: 'How to Get Started with WhatsApp Business API in 5 Minutes',
        description: 'Step-by-step guide to connect your business WhatsApp number, invite team agents, and launch conversational marketing campaigns using Resend.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Create Your Free Trial Workspace',
            text: 'Sign up in 60 seconds with your email and business details. Then claim a 7-day free trial from your dashboard, no credit card required.',
            url: `${siteConfig.url}/#register`,
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Connect Your WhatsApp Number',
            text: 'Choose your connection engine: Link directly with official Meta WhatsApp Cloud API or pair instantly via QR scan.',
            url: `${siteConfig.url}/#how-it-works`,
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Manage Chats & Automate Workflows',
            text: 'Invite your team to the shared inbox, build visual auto-reply chatbots, and broadcast verified template campaigns.',
            url: `${siteConfig.url}/features`,
          },
        ],
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
              text: 'Getting started takes under 5 minutes. Sign up, claim your free trial, create your workspace, and connect your WhatsApp number via Meta Cloud API or QR engine.',
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
          {
            '@type': 'Question',
            name: 'How does Resend compare as an alternative to WATI or AiSensy?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Resend provides dual-engine connectivity (Meta Cloud API plus rapid QR pairing), flat transparent subscription pricing with 0% platform markup on Meta conversation fees, an included visual flow builder, and developer-friendly REST APIs and webhooks.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does Resend protect businesses against WhatsApp account bans during broadcasts?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Resend incorporates automated anti-ban rate limiting, randomized delivery pacing, opt-out management, and template compliance verification. For Meta Cloud API users, messages are sent through Meta official tier-escalated infrastructure in 100% compliance with WhatsApp Business Messaging Policies.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I integrate Resend with Shopify, WooCommerce, or custom CRM systems?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Resend provides bidirectional webhooks and comprehensive HTTP REST APIs that connect with e-commerce platforms, Zapier, Make, HubSpot, and custom backend databases for automated order alerts, abandoned cart recovery, and lead synchronization.',
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
