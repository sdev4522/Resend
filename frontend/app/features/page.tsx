import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFeatures } from '@/components/marketing/features';
import { MarketingProductShowcase } from '@/components/marketing/product-showcase';
import { MarketingTrustBar } from '@/components/marketing/trust-bar';
import { MarketingCTABanner } from '@/components/marketing/cta-banner';
import { MarketingFooter } from '@/components/marketing/footer';
import { StickyMobileCTA } from '@/components/marketing/sticky-mobile-cta';
import { PageBreadcrumb } from '@/components/marketing/page-breadcrumb';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Features — WhatsApp Cloud API, Inbox & Automation',
  description:
    'Explore official WhatsApp Cloud API broadcasting, visual no-code flow builder, multi-agent shared inbox, and developer APIs.',
  keywords: [
    'WhatsApp Cloud API features',
    'WhatsApp Shared Inbox',
    'WhatsApp Visual Flow Builder',
    'WhatsApp Marketing Broadcasts',
    'WhatsApp Contacts CRM',
    'Multi-Agent WhatsApp',
    'WhatsApp Developer REST API',
    'WhatsApp Webhooks',
    'WhatsApp Automation Tools',
  ],
  alternates: {
    canonical: 'https://resend.in/features',
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
  const jsonLd = {
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
            name: 'Features',
            item: `${siteConfig.url}/features`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${siteConfig.url}/features#list`,
        name: 'Resend Platform Features',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Official Meta WhatsApp Cloud API',
            description: 'Direct server-to-server connection to Meta infrastructure for verified high-throughput business messaging.',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Multi-Agent Shared Team Inbox',
            description: 'Collaborative inbox with automatic routing, agent assignments, and private notes for simultaneous team responses.',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Visual No-Code Flow Builder',
            description: 'Drag-and-drop conversational node editor for automated decision trees, keyword triggers, and interactive button menus.',
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: 'Bulk Template Broadcast Campaigns',
            description: 'Segmented template messaging with real-time delivery tracking, read receipts, and automated rate limiting.',
          },
          {
            '@type': 'ListItem',
            position: 5,
            name: 'Contacts CRM & Segmentation',
            description: 'Rich contact management with custom tags, dynamic attributes, phonebook grouping, and CSV synchronization.',
          },
          {
            '@type': 'ListItem',
            position: 6,
            name: 'Developer REST API & Webhooks',
            description: 'Robust HTTP REST endpoints and event webhooks for bidirectional sync with Shopify, WooCommerce, and CRM platforms.',
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
        <PageBreadcrumb items={[{ name: 'Features' }]} />
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
