'use client';

import React from 'react';
import { BentoGrid, BentoCard } from '@/components/ui/bento-grid';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Users,
  FileText,
  GitFork,
  Radio,
  CheckCheck,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function MarketingBentoFeatures() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <Badge
          variant="outline"
          className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
        >
          Comprehensive Platform Capabilities
        </Badge>
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Built for High-Velocity WhatsApp Teams
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Every tool your team needs to manage incoming chats, dispatch high-deliverability broadcast campaigns, and automate customer journeys from one platform.
        </p>
      </div>

      {/* Asymmetric Bento Grid */}
      <BentoGrid className="auto-rows-[22rem] md:auto-rows-[24rem]">
        {/* Card 1: Team Inbox & Multi-Agent Routing (Large - 2 cols on md/lg) */}
        <BentoCard
          name="Collaborative Multi-Agent Team Inbox"
          description="Consolidate official WhatsApp numbers into a shared inbox. Multiple team agents log in simultaneously, assign incoming conversations, and leave private internal notes without disconnecting each other."
          Icon={MessageSquare}
          badge="Core Workflow"
          className="md:col-span-2"
          cta="Explore Inbox"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-6 top-16 flex flex-col gap-2 rounded-xl border border-border/80 bg-background/90 p-4 shadow-sm opacity-90 transition-all duration-300 group-hover:scale-[1.01]">
              <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                    SJ
                  </span>
                  <span className="font-semibold text-foreground">Sarah Jenkins</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    VIP Customer
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Assigned to: Elena R.
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs pt-1">
                <div className="self-start max-w-[85%] rounded-lg bg-muted p-2 text-foreground text-[11px]">
                  Can we add 10 support agents to our account?
                </div>
                <div className="self-end max-w-[85%] rounded-lg bg-primary p-2 text-primary-foreground text-[11px] flex items-center gap-1.5">
                  <span>Yes! All plans support multi-agent concurrent seats.</span>
                  <CheckCheck className="h-3 w-3 shrink-0" />
                </div>
              </div>
            </div>
          }
        />

        {/* Card 2: Broadcast Campaigns & Delivery Telemetry (1 col) */}
        <BentoCard
          name="High-Deliverability Campaigns"
          description="Schedule personalized template broadcasts to segmented contact audiences. Merges dynamic parameters ({{name}}, {{order_id}}) and tracks live delivery and read rates."
          Icon={Send}
          badge="High Deliverability"
          className="md:col-span-1"
          cta="View Broadcasts"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-4 top-16 rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-foreground">Campaign: Q4_Onboarding</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  98.4% Sent
                </span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Success</span>
                  <span className="font-mono text-foreground font-semibold">4,920 / 5,000</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-[98.4%]" />
                </div>
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Read Rate</span>
                  <span className="font-mono text-primary font-semibold">82.6%</span>
                </div>
              </div>
            </div>
          }
        />

        {/* Card 3: Contact CRM & Audience Directory (1 col) */}
        <BentoCard
          name="Contact CRM & CSV Import"
          description="Organize your customer directory with custom attributes, audience tags, phonebook segments, and instant CSV upload/export capabilities."
          Icon={Users}
          badge="Directory"
          className="md:col-span-1"
          cta="Learn More"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-4 top-16 space-y-2 rounded-xl border border-border/80 bg-background/90 p-3 shadow-sm text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="font-semibold text-foreground">Customer Contacts</span>
                <span className="text-[10px] text-primary font-medium">CSV Sync Active</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-foreground">David Miller</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary font-medium">
                    Enterprise
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-foreground">Amina Yusuf</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium">
                    Trial User
                  </span>
                </div>
              </div>
            </div>
          }
        />

        {/* Card 4: Visual Flow Builder & Keyword Chatbots (Large - 2 cols on md/lg) */}
        <BentoCard
          name="Visual Flow Builder &amp; Keyword Chatbots"
          description="Deploy 24/7 automated lead qualification funnels, FAQ replies, and interactive button menus. Route inquiries automatically without writing code."
          Icon={GitFork}
          badge="Automation"
          className="md:col-span-2"
          cta="See Flow Builder"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-6 top-16 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-sm">
              <div className="flex-1 rounded-lg border border-border/60 bg-muted/40 p-2 text-center text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  1. Trigger
                </span>
                <span className="text-[11px] font-medium text-foreground">Keyword &quot;/demo&quot;</span>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 rounded-lg border border-primary/40 bg-primary/5 p-2 text-center text-xs">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                  2. Condition
                </span>
                <span className="text-[11px] font-medium text-foreground">Is Business Hours?</span>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 rounded-lg border border-border/60 bg-muted/40 p-2 text-center text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  3. Action
                </span>
                <span className="text-[11px] font-medium text-foreground">Interactive Buttons</span>
              </div>
            </div>
          }
        />

        {/* Card 5: Meta-Approved Template Management (1 col) */}
        <BentoCard
          name="Meta Template Sync"
          description="Compose and synchronize official WhatsApp templates with headers, dynamic body text, and quick-reply buttons. Track approval state in real time."
          Icon={FileText}
          badge="Verified"
          className="md:col-span-1"
          cta="Explore Templates"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-4 top-16 rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-sm text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-foreground text-[11px]">template_order_update</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  APPROVED
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                &quot;Hi &#123;&#123;1&#125;&#125;, your order &#123;&#123;2&#125;&#125; is confirmed! Track shipment below:&quot;
              </p>
              <div className="mt-2 rounded border border-border/50 bg-muted/30 py-1 text-center text-[10px] text-primary font-medium">
                Button: [ Track Order ]
              </div>
            </div>
          }
        />

        {/* Card 6: Dual Engine Connectivity (2 cols on md/lg or 1 col) */}
        <BentoCard
          name="Official Cloud API &amp; QR Instances"
          description="Connect via Meta's official Cloud API for enterprise scale and zero phone dependency, or use high-speed QR instances for rapid onboarding."
          Icon={Radio}
          badge="Flexible Engine"
          className="md:col-span-2"
          cta="Connection Options"
          href="/#how-it-works"
          background={
            <div className="absolute inset-x-6 top-16 grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-sm text-xs">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-primary font-bold text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Meta Cloud API</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Official Graph API, zero phone dependency, high tier messaging limits.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-foreground font-bold text-[11px]">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>QR Engine</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Instant scan setup for existing standard and business numbers.
                </p>
              </div>
            </div>
          }
        />
      </BentoGrid>
    </section>
  );
}
