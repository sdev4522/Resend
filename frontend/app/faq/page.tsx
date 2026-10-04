import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFAQ } from '@/components/marketing/faq';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions — WhatsApp CRM & Cloud API',
  description:
    'Answers to common questions regarding WhatsApp Cloud API integration, multi-agent inbox setup, broadcast deliverability, and SaaS billing.',
  alternates: {
    canonical: '/faq',
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
        name: 'How does billing work and can I cancel?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Billing is transparent and calculated using real-time SaaS rates. You can choose monthly or annual billing directly from your workspace dashboard, and upgrade, downgrade, or cancel your subscription at any time.',
        },
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
        <MarketingFAQ />
        <MarketingCTABanner />
      </main>
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}
