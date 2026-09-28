import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { ContactForm } from '@/components/contact/contact-form';
import { Mail, MessageSquare, Clock, ShieldCheck } from 'lucide-react';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Contact Sales & Customer Support',
  description:
    'Get in touch with our team for product inquiries, onboarding guidance, or technical assistance with WhatsApp Cloud API integration.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact WaCRM — Sales & Customer Support',
    description:
      'Get in touch with our team for product inquiries, onboarding guidance, or technical assistance with WhatsApp Cloud API integration.',
    url: `${siteConfig.url}/contact`,
    siteName: siteConfig.name,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Contact WaCRM Support',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact WaCRM — Sales & Customer Support',
    description:
      'Get in touch with our team for product inquiries, onboarding guidance, or technical assistance with WhatsApp Cloud API integration.',
    images: ['/og.png'],
  },
};

export default function ContactPage() {
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
        name: 'Contact',
        item: `${siteConfig.url}/contact`,
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

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Get in Touch
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Have questions about onboarding, WhatsApp Cloud API limits, or custom plan requirements? We are here to help.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Contact Information & Channels */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs space-y-6">
                <h2 className="text-xl font-semibold text-foreground">
                  Support &amp; Sales Channels
                </h2>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Email Inquiries</p>
                      <a
                        href={`mailto:${siteConfig.contactEmail}`}
                        className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                      >
                        {siteConfig.contactEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Response Expectation</p>
                      <p className="text-muted-foreground">
                        Inquiries are typically answered within 1 business day.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">WhatsApp Direct Support</p>
                      <p className="text-muted-foreground">
                        Available for active subscribers inside the workspace dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Infrastructure</p>
                      <p className="text-muted-foreground">
                        Cloud-hosted SaaS platform built on official Meta Graph APIs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Help & Documentation Card */}
              <div className="rounded-2xl border bg-card/60 p-6 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Need Immediate Answers?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Browse our frequently asked questions or technical guides to resolve common configuration questions.
                </p>
                <div className="pt-1 flex flex-wrap gap-2">
                  <Link
                    href="/faq"
                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    View FAQ →
                  </Link>
                  <span className="text-xs text-muted-foreground">•</span>
                  <Link
                    href="/features"
                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    Explore Features →
                  </Link>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-xs">
                <h2 className="text-xl font-semibold text-foreground mb-6">
                  Send a Message
                </h2>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
