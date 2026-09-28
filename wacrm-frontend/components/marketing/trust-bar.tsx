'use client';

import React from 'react';
import { ShieldCheck, Server, KeyRound, Radio, Cpu, RefreshCw } from 'lucide-react';

const TRUST_PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Meta Cloud API Direct',
    desc: 'Official Graph API compliance with verified sender identity & zero risk of account ban.',
  },
  {
    icon: Radio,
    title: 'Dual Engine Architecture',
    desc: 'Support for official Meta Cloud API alongside high-speed Baileys QR connection instances.',
  },
  {
    icon: KeyRound,
    title: 'Role-Based Team Access',
    desc: 'Workspace level security with granular Admin, Agent, and Member permission boundaries.',
  },
  {
    icon: RefreshCw,
    title: 'Real-Time WebSocket Sync',
    desc: 'Instant two-way conversation streaming with zero polling and sub-second message delivery.',
  },
  {
    icon: Cpu,
    title: 'Developer REST API & Webhooks',
    desc: 'HMAC-SHA256 verified inbound webhooks, scoped API keys, and comprehensive event logging.',
  },
  {
    icon: Server,
    title: 'Dedicated Session Fleet',
    desc: 'Independent process isolation per WhatsApp number with automated reconnect lifecycle.',
  },
];

export function MarketingTrustBar() {
  return (
    <section className="py-12 sm:py-16 border-y border-border/50 bg-muted/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Enterprise Architecture &amp; Reliability
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-2">
            Built for High-Stakes Customer Operations
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Engineered around verifiable WhatsApp protocols, hardened multi-tenant isolation, and reliable delivery queues.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRUST_PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="p-5 rounded-xl border border-border/60 bg-card/60 hover:border-foreground/20 transition-colors space-y-2.5"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{pillar.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
