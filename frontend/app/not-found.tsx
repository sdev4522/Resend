import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquareQuote, Home, HelpCircle } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist or may have moved.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />

      <main className="flex-1 flex items-center justify-center px-4 py-24 sm:py-32">
        <div className="max-w-md w-full text-center">
          {/* Brand icon / 404 badge */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-foreground border shadow-xs">
            <MessageSquareQuote className="h-8 w-8 text-primary" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Error 404
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Page Not Found
          </h1>

          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            The page you are looking for doesn&apos;t exist, has been removed, or may have moved to a different destination.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              render={<Link href="/" />}
              size="lg"
              className="w-full sm:w-auto rounded-full"
            >
              <Home className="mr-2 h-4 w-4" /> Back to Home
            </Button>

            <Button
              render={<Link href="/contact" />}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-full"
            >
              <HelpCircle className="mr-2 h-4 w-4" /> Contact Support
            </Button>
          </div>

          {/* Secondary links */}
          <div className="mt-10 border-t pt-6 text-xs text-muted-foreground flex items-center justify-center gap-4">
            <Link href="/features" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Features
            </Link>
            <span>•</span>
            <Link href="/pricing" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Pricing
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
