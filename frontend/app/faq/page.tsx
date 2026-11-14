import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { PageBreadcrumb } from '@/components/marketing/page-breadcrumb';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions — WhatsApp CRM & Cloud API',
  description:
    'Answers to common questions regarding WhatsApp Cloud API integration, multi-agent inbox setup, broadcast deliverability, and SaaS billing.',
  keywords: [
    'WhatsApp Business API FAQ',
    'WhatsApp CRM questions',
    'Meta WhatsApp Cloud API setup guide',
    'WhatsApp shared inbox multi-agent',
    'Meta conversation fees FAQ',
    'WATI vs Resend',
    'AiSensy vs Resend',
    'WhatsApp broadcast rules anti-ban',
  ],
  alternates: {
    canonical: 'https://resend.in/faq',
  },
  openGraph: {
    title: 'Frequently Asked Questions — WhatsApp CRM & Cloud API | Resend',
    description:
      'Answers to common questions regarding WhatsApp Cloud API integration, multi-agent inbox setup, broadcast deliverability, and SaaS billing.',
    url: `${siteConfig.url}/faq`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Resend Frequently Asked Questions',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frequently Asked Questions — WhatsApp CRM & Cloud API | Resend',
    description:
      'Answers to common questions regarding WhatsApp Cloud API integration, multi-agent inbox setup, broadcast deliverability, and SaaS billing.',
    images: ['/og.png'],
  },
};

export default function FAQPage() {
  const faqJsonLd = {
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
            name: 'FAQ',
            item: `${siteConfig.url}/faq`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is Resend?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Resend is an official B2B customer relationship management and team inbox platform for WhatsApp. It allows teams to consolidate WhatsApp conversations, automate routine interactions, run broadcast campaigns, and collaborate seamlessly from a single workspace.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does WhatsApp integration work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Resend supports direct integration with Meta’s official WhatsApp Business Cloud API for enterprise deliverability and high message limits. For businesses with existing numbers, we also offer high-speed QR instance connectivity for rapid setup.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can multiple agents respond from the same number?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Your entire team can log in simultaneously, view shared customer conversations, assign chats to specific agents, add internal collaboration notes, and reply without disconnecting other agents.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I connect multiple WhatsApp numbers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Depending on your subscription tier, you can connect multiple official WhatsApp numbers to one central workspace and route incoming conversations by department.',
            },
          },
          {
            '@type': 'Question',
            name: 'Are there additional charges from Meta for WhatsApp conversations?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'If using Meta Cloud API, WhatsApp conversation charges are billed directly by Meta according to official conversation rates. Meta includes 1,000 free service conversations per month per business portfolio. QR connections use your regular phone plan without Meta conversation fees.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does billing work and can I cancel?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Billing is transparent and calculated using real-time SaaS rates. You can choose monthly or annual billing directly from your workspace dashboard, and upgrade, downgrade, or cancel your subscription at any time.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does Resend compare to alternatives like WATI and AiSensy?',
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
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingNavbar />
      <main className="flex-1 pt-16 xs:pt-20 sm:pt-24 pb-16 sm:pb-0">
        <PageBreadcrumb items={[{ name: 'FAQ' }]} />
        <MarketingFAQ isPageHeading />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
