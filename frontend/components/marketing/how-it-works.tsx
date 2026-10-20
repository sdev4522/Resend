'use client';

import React from 'react';
import { Radio, Sliders, Send, Clock } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: Radio,
    title: 'Connect your WhatsApp Business account',
    description:
      'Link your WhatsApp Business phone number using enterprise Meta Cloud API credentials or our instant QR connection engine. No physical phone hardware required for Cloud API.',
    notice: 'Meta review applies to official Cloud API; QR engine connects immediately.',
  },
  {
    step: '02',
    icon: Sliders,
    title: 'Configure your API and messaging workflows',
    description:
      'Sync Meta-approved message templates with dynamic variables, configure keyword auto-responders, and connect HMAC-SHA256 webhooks for real-time CRM updates.',
    notice: 'Templates submit directly to Meta with status updates in dashboard.',
  },
  {
    step: '03',
    icon: Send,
    title: 'Manage conversations and automate operations',
    description:
      'Collaborate in real time from a shared team inbox. Multiple agents reply simultaneously, assign chats, leave internal notes, and schedule targeted broadcasts.',
    notice: 'Broadcast limits adhere to Meta Business messaging tier guidelines.',
  },
];

export function MarketingHowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
          Simple Onboarding
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          How Resend Works in Practice
        </h2>
        <p className="mt-3.5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          From account setup to collaborative customer messaging in three clear steps.
        </p>
      </div>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {STEPS.map((s) => (
          <div
            key={s.step}
            className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 sm:p-7 shadow-xs"
          >
            <div>
              {/* Step indicator header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50">
                  STEP {s.step}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug">
                {s.title}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </div>

            {/* Compliance notice */}
            <div className="mt-6 pt-3.5 border-t border-border/40 flex items-start gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{s.notice}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
