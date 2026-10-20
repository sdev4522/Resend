'use client';

import React from 'react';
import { Marquee } from '@/components/ui/marquee';
import {
  Radio,
  MessageSquare,
  Send,
  Webhook,
  GitFork,
  Code2,
  Database,
  Layers,
  Globe,
  Zap,
  ShieldCheck,
} from 'lucide-react';

interface IntegrationItem {
  name: string;
  icon: React.ElementType;
}

const INTEGRATIONS: IntegrationItem[] = [
  { name: 'Meta WhatsApp Cloud API', icon: Radio },
  { name: 'Multi-Agent Team Inbox', icon: MessageSquare },
  { name: 'Template Broadcasts', icon: Send },
  { name: 'Instant QR Device Sync', icon: Layers },
  { name: 'Visual Flow Automation', icon: GitFork },
  { name: 'Developer REST API v2', icon: Code2 },
  { name: 'HMAC Inbound Webhooks', icon: Webhook },
  { name: 'Contact CRM & Custom Tags', icon: Database },
  { name: 'Keyword Auto-Responders', icon: Zap },
  { name: 'Interactive WhatsApp Forms', icon: Globe },
  { name: 'Secure Razorpay Billing', icon: ShieldCheck },
];

export function MarketingCapabilityMarquee() {
  return (
    <section
      aria-label="Supported Integrations and Platform Capabilities"
      className="relative w-full border-y border-border/50 bg-muted/20 py-8 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 text-center mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Official Meta Cloud API Infrastructure · Instant QR Engine · Developer REST API
        </p>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden">
        <Marquee pauseOnHover className="[--duration:40s] [--gap:0.75rem]">
          {INTEGRATIONS.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3.5 py-2 shadow-2xs transition-colors hover:border-primary/40"
            >
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground whitespace-nowrap">
                {item.name}
              </span>
            </div>
          ))}
        </Marquee>

        {/* Gradient Fade Masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 sm:w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 sm:w-32 bg-gradient-to-l from-background to-transparent z-10" />
      </div>
    </section>
  );
}
