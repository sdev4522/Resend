'use client';

import React from 'react';
import {
  Building2,
  QrCode,
  UserPlus,
  MessageSquare,
  Zap,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    step: '01',
    icon: Building2,
    title: 'Create Your Workspace',
    description:
      'Set up your company profile, timezone, and preferred currency in seconds. No complex provisioning required.',
  },
  {
    step: '02',
    icon: QrCode,
    title: 'Connect WhatsApp',
    description:
      'Link your official Meta Cloud API credentials or scan our high-speed QR engine for instant connectivity.',
  },
  {
    step: '03',
    icon: UserPlus,
    title: 'Invite Team & Assign Roles',
    description:
      'Add support agents and administrators with scoped permissions. Keep billing and settings safe.',
  },
  {
    step: '04',
    icon: MessageSquare,
    title: 'Manage Conversations',
    description:
      'Handle inbound messages in the real-time shared inbox with internal notes, customer tags, and quick replies.',
  },
  {
    step: '05',
    icon: Zap,
    title: 'Automate & Broadcast',
    description:
      'Launch personalized template broadcasts and deploy visual chatbot flows for 24/7 self-service.',
  },
  {
    step: '06',
    icon: BarChart3,
    title: 'Track Results & Optimize',
    description:
      'Review message delivery rates, first response times, and agent resolution throughput via live analytics.',
  },
];

export function MarketingHowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <Badge variant="outline" className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3">
          Onboarding Process
        </Badge>
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          How Resend Works in Practice
        </h2>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground">
          Go from setup to live multi-agent WhatsApp customer support in under 10 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {STEPS.map((s) => (
          <div
            key={s.step}
            className="relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-6 sm:p-7 hover:border-primary/40 transition-all space-y-4 group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs font-bold text-muted-foreground/60">
                  STEP {s.step}
                </span>
              </div>

              <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                {s.title}
              </h3>

              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </div>

            <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Ready in minutes</span>
              <ArrowRight className="h-3 w-3 text-primary" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
