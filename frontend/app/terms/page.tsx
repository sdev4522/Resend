import React from 'react';
import type { Metadata } from 'next';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Review terms of service, acceptable messaging policies, WhatsApp Meta API compliance, and subscription guidelines for Resend.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms and Conditions — Resend',
    description:
      'Review terms of service, acceptable messaging policies, WhatsApp Meta API compliance, and subscription guidelines for Resend.',
    url: `${siteConfig.url}/terms`,
    siteName: siteConfig.name,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Resend Terms and Conditions' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms and Conditions — Resend',
    description:
      'Review terms of service, acceptable messaging policies, WhatsApp Meta API compliance, and subscription guidelines for Resend.',
    images: ['/og.png'],
  },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: September 25, 2026
          </p>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Agreement to Terms</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;Customer&quot;, &quot;User&quot;, or &quot;you&quot;) and Resend (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an account, accessing, or using the Resend platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Account Registration &amp; Security</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You must provide accurate, current, and complete information during registration. You are solely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your workspace accounts. You agree to notify us immediately of any unauthorized access or security breach.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. WhatsApp &amp; Meta Platform Dependency</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Resend connects to Meta Platforms&apos; official WhatsApp Cloud API to facilitate message dispatch and reception. You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>
                You must comply at all times with the official <strong>WhatsApp Business Messaging Policy</strong> and <strong>Commerce Policy</strong>.
              </li>
              <li>
                You will not use Resend to distribute unsolicited promotional spam, phishing links, misleading material, or promote illegal or restricted goods.
              </li>
              <li>
                Meta maintains sole discretion over WhatsApp account health, quality ratings, message template approvals, and rate tiers. Resend is not liable for account bans or restrictions resulting from Customer policy violations.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Subscriptions, Invoicing &amp; Cancellation</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Resend services are offered on monthly and annual recurring subscription tiers. Each tier specifies allowances including agent seat licenses, connected phone numbers, and contact storage thresholds.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
              <li>
                Subscriptions automatically renew at the beginning of each billing cycle unless cancelled prior to renewal through your workspace billing dashboard.
              </li>
              <li>
                Meta may assess conversation charges for WhatsApp template messages. Meta conversation fees are billed in accordance with Meta&apos;s published pricing structure and are separate from Resend platform software subscriptions.
              </li>
              <li>
                Refund requests are evaluated on a case-by-case basis in accordance with applicable consumer laws.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Service Availability &amp; SLA</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We strive to maintain high platform availability and low latency. However, scheduled maintenance, emergency security patches, or external Meta infrastructure outages may temporarily impact service availability. We do not guarantee uninterrupted operation under all network conditions.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Limitation of Liability</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To the maximum extent permitted by applicable law, in no event shall Resend be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data loss, or business interruption arising out of your use or inability to use the service.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Contact Information</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For questions regarding these Terms, please contact us at:
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
