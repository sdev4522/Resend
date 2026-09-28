import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Understand how WaCRM collects, protects, and manages account data, messaging metadata, and integration security.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy — WaCRM',
    description:
      'Understand how WaCRM collects, protects, and manages account data, messaging metadata, and integration security.',
    url: `${siteConfig.url}/privacy`,
    siteName: siteConfig.name,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'WaCRM Privacy Policy' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — WaCRM',
    description:
      'Understand how WaCRM collects, protects, and manages account data, messaging metadata, and integration security.',
    images: ['/og.png'],
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: September 25, 2026
          </p>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              WaCRM (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a cloud-based WhatsApp Customer Relationship Management, broadcast automation, and multi-agent communication platform. This Privacy Policy details the types of personal data we collect, how it is processed and secured, and your rights regarding your information.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Data We Collect</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We collect only the data necessary to provide our CRM services effectively:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>
                <strong>Account Data:</strong> Full name, work email address, hashed passwords, workspace organization details, and assigned user roles.
              </li>
              <li>
                <strong>WhatsApp Cloud API Credentials:</strong> Meta App IDs, Phone Number IDs, WhatsApp Business Account (WABA) IDs, and Graph API access tokens provided by you to enable messaging through your official WhatsApp Business number.
              </li>
              <li>
                <strong>Contact &amp; Customer Lists:</strong> Phone numbers, customer names, contact attributes, and custom tags uploaded or synchronized by your workspace administrators.
              </li>
              <li>
                <strong>Messaging &amp; Webhook Logs:</strong> Inbound and outbound message text, template message statuses (sent, delivered, read, failed), timestamps, and conversation assignment records.
              </li>
              <li>
                <strong>Billing Data:</strong> Subscription tier, plan limits, and transaction identifiers. Payment processing is handled by third-party processors (such as Stripe or Razorpay); we do not store raw credit card numbers or CVV codes on our servers.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. WhatsApp &amp; Meta Platform Compliance</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Our service operates in integration with Meta Platforms&apos; official WhatsApp Cloud API. By using WaCRM, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>
                Message delivery relies on Meta&apos;s infrastructure and is governed by the WhatsApp Business Terms of Service and Meta Privacy Policy.
              </li>
              <li>
                You are responsible for obtaining all necessary consent and opt-ins from recipients before initiating broadcast or template messages.
              </li>
              <li>
                We do not sell, rent, or monetize your customer contact directories or message contents with third parties.
              </li>
            </ul>
          </section>

          <section id="cookies" className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Cookies &amp; Local Storage</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We employ cookies and browser storage solely for functional operation and security:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>
                <strong>Essential Cookies:</strong> Encrypted session identifiers (<code>wacrm_session</code>, <code>wacrm_role</code>) strictly required to maintain secure user authentication, multi-factor verification, and role-based permissions.
              </li>
              <li>
                <strong>Preference Storage:</strong> Local storage values for interface theme (light/dark mode) and cookie consent status.
              </li>
              <li>
                <strong>Optional Telemetry:</strong> Aggregated, anonymized website navigation metrics used solely to diagnose platform latency and optimize feature discovery. This telemetry is disabled unless you provide consent.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Data Retention &amp; Security</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              All communications between your browser, our servers, and the Meta Cloud API are encrypted in transit using industry-standard TLS 1.3 encryption. Workspace data is stored in isolated relational databases with role-based access restrictions. We retain customer data as long as your workspace account remains active. Upon account termination or written request, workspace databases and associated contact records are scheduled for permanent purge.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Depending on your location, you may have rights under the GDPR, CCPA, or applicable local data protection regulations, including:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>The right to access and export your workspace contacts and data.</li>
              <li>The right to rectify inaccurate personal information.</li>
              <li>The right to request deletion of your account and related records.</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Contact Information</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For any privacy inquiries, data deletion requests, or questions regarding our data practices, please contact us at:
            </p>
            <p className="text-sm font-medium text-foreground">
              Email: <a href={`mailto:${siteConfig.contactEmail}`} className="text-primary hover:underline">{siteConfig.contactEmail}</a>
            </p>
          </section>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
