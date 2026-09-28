'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquareQuote, Mail, ShieldCheck } from 'lucide-react';
import { siteConfig } from '@/config/site';

export function MarketingFooter() {
  const handleOpenCookieSettings = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('wacrm_open_cookie_banner'));
    }
  };

  return (
    <footer className="border-t bg-background/50 py-12 lg:py-16 text-sm text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand info */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MessageSquareQuote className="h-4 w-4" />
              </div>
              <span>WaCRM</span>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Official WhatsApp CRM, automation, and multi-agent customer communication suite.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-foreground transition-colors">
                {siteConfig.contactEmail}
              </a>
            </div>
          </div>

          {/* Product links */}
          <div className="flex flex-col gap-2.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Product</span>
            <Link href="/features" className="text-xs hover:text-foreground transition-colors">
              Features &amp; API
            </Link>
            <Link href="/pricing" className="text-xs hover:text-foreground transition-colors">
              Pricing Plans
            </Link>
            <Link href="/#faq" className="text-xs hover:text-foreground transition-colors">
              Frequently Asked Questions
            </Link>
          </div>

          {/* Company & Support */}
          <div className="flex flex-col gap-2.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Support</span>
            <Link href="/contact" className="text-xs hover:text-foreground transition-colors">
              Contact Sales &amp; Support
            </Link>
            <Link href="/login" className="text-xs hover:text-foreground transition-colors">
              Customer Sign In
            </Link>
            <Link href="/register" className="text-xs hover:text-foreground transition-colors">
              Create Account
            </Link>
          </div>

          {/* Legal & Trust */}
          <div className="flex flex-col gap-2.5">
            <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Trust &amp; Legal</span>
            <Link href="/privacy" className="text-xs hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs hover:text-foreground transition-colors">
              Terms &amp; Conditions
            </Link>
            <button
              onClick={handleOpenCookieSettings}
              className="text-xs text-left text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cookie Settings
            </button>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} WaCRM. All rights reserved.</p>
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Meta WhatsApp Cloud API Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
