import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Home, ArrowRight } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata = {
  title: 'Message Received — Resend',
  description: 'Thank you for reaching out to Resend. We have received your inquiry.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />

      <main className="flex-1 flex items-center justify-center px-4 py-24 sm:py-32">
        <div className="max-w-lg w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border shadow-xs">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Thank You for Reaching Out
          </h1>

          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Your inquiry has been received by the Resend team. We review submissions during standard business hours and will follow up with you at the email address provided.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              render={<Link href="/" />}
              size="lg"
              className="w-full sm:w-auto rounded-full"
            >
              <Home className="mr-2 h-4 w-4" /> Return to Homepage
            </Button>

            <Button
              render={<Link href="/features" />}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-full"
            >
              Explore Features <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
