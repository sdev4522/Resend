'use client';

import React from 'react';
import {
  UserPlus,
  Radio,
  Send,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

const WORKFLOW_STEPS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Create Your Workspace',
    subtitle: '60-Second Setup · 14-Day Free Trial',
    description:
      'Sign up with email or Google to provision your secure workspace. Define your company profile, time zone, and invite your support agents with role-based permissions.',
    bullets: [
      'Instant workspace creation with zero credit card requirement',
      'Invite unlimited agents with Admin or Agent permissions',
      'Configurable working hours and default auto-responders',
    ],
  },
  {
    step: '02',
    icon: Radio,
    title: 'Connect WhatsApp',
    subtitle: 'Official Meta Cloud API or Fast QR Engine',
    description:
      'Link your WhatsApp Business numbers according to your operational needs. Use official Meta Cloud API credentials for enterprise scale, or connect an existing number via QR code scan.',
    bullets: [
      'Meta Cloud API: 100% policy-compliant, verified business sender status, no physical phone needed',
      'QR Instance Engine: Instant scan-to-connect for existing WhatsApp accounts without Meta review',
      'Clear in-dashboard status indicators for connection health and token renewal',
    ],
  },
  {
    step: '03',
    icon: Send,
    title: 'Manage Conversations & Campaigns',
    subtitle: 'Multi-Agent Inbox & Verified Broadcasts',
    description:
      'Your team can immediately respond to inbound customer messages from the shared team inbox, organize contacts with custom attributes, and launch scheduled template campaigns.',
    bullets: [
      'Concurrent agent logins to answer customer inquiries simultaneously',
      'Internal team notes, chat resolution tags, and canned quick replies',
      'Meta-approved template broadcasts with delivery & read-receipt telemetry',
    ],
  },
];

export function MarketingHowItWorks() {
  const { openRegister } = useAuthDialog();

  return (
    <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <Badge
          variant="outline"
          className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
        >
          Three-Step Workflow
        </Badge>
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          How Resend Works in Practice
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          From account registration to active multi-agent conversation management in minutes.
        </p>
      </div>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {WORKFLOW_STEPS.map((s) => (
          <div
            key={s.step}
            className="relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 sm:p-8 hover:border-primary/40 transition-all duration-300 shadow-xs hover:shadow-md space-y-6 group"
          >
            <div>
              {/* Step indicator header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                  <s.icon className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs font-extrabold text-muted-foreground/60 tracking-wider">
                  STEP {s.step}
                </span>
              </div>

              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                {s.title}
              </h3>
              <p className="text-xs font-semibold text-primary mt-1">
                {s.subtitle}
              </p>

              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>

              {/* Bullet details */}
              <ul className="mt-5 space-y-2.5 pt-4 border-t border-border/50 text-xs text-foreground/90">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="leading-normal">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={openRegister}
                className="w-full text-xs font-semibold text-primary hover:text-primary/90 justify-between group/btn cursor-pointer -ml-1"
              >
                <span>Get Started with Step {s.step}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Honest Architectural Callout Banner */}
      <div className="mt-12 rounded-2xl border border-border/80 bg-muted/20 p-5 sm:p-6 text-xs sm:text-sm text-muted-foreground flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground block">
              Transparent Integration Guidelines
            </span>
            <span>
              QR connections provide immediate connectivity for testing and existing numbers. Official Meta Cloud API provides enterprise message volume tiers; Meta review and template approval times vary according to Meta Business policies.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
