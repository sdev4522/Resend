'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  GitFork,
  BarChart3,
  Users,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ModuleKey = 'inbox' | 'campaigns' | 'templates' | 'automation' | 'contacts' | 'analytics';

interface ModuleDetail {
  id: ModuleKey;
  label: string;
  icon: any;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
}

const MODULES: ModuleDetail[] = [
  {
    id: 'inbox',
    label: 'Team Inbox',
    icon: MessageSquare,
    title: 'Collaborative Multi-Agent WhatsApp Inbox',
    tagline: 'Route customer conversations to the right team members in milliseconds.',
    description:
      'Eliminate phone handover chaos. Multiple agents log in concurrently to answer inquiries from one or more official numbers, leave private internal notes, and apply custom resolution tags.',
    bullets: [
      'Live WebSocket delivery with zero message latency',
      'Agent assignment & internal collaboration notes',
      'Saved quick-reply canned responses & media attachments',
      'Conversation resolution tags (e.g. VIP, Support, Billing)',
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Send,
    title: 'High-Deliverability Broadcast Campaigns',
    tagline: 'Deliver verified marketing and transactional broadcasts to targeted contact segments.',
    description:
      'Upload segmented contact lists, personalize template parameters, schedule automated dispatch times, and track live read rates across every recipient.',
    bullets: [
      'Official Meta approved template synchronization',
      'Dynamic variable merging (e.g. {{name}}, {{order_id}})',
      'Intelligent pacing & throttling to protect sender reputation',
      'Live delivery, read, and failure telemetry logs',
    ],
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    title: 'Meta-Approved Template Management',
    tagline: 'Compose and synchronize official WhatsApp templates with instant approval status.',
    description:
      'Create compliant message templates with media headers, dynamic variables, and interactive call-to-action or quick-reply buttons directly synced with Meta Business Manager.',
    bullets: [
      'Direct synchronization with Meta WhatsApp Cloud API',
      'Header, body, footer, and interactive action buttons',
      'Live approval status tracking (APPROVED, PENDING, REJECTED)',
      'Multi-language template variations with locale support',
    ],
  },
  {
    id: 'contacts',
    label: 'Contact CRM',
    icon: Users,
    title: 'Unified Customer Directory & Attribute Storage',
    tagline: 'Store contact details, custom fields, and engagement history in one place.',
    description:
      'Organize hundreds of thousands of contacts with tags, custom parameters, phonebook groups, and CSV import/export capabilities.',
    bullets: [
      'Custom key-value attributes for deep customer profiling',
      'Dynamic group filtering for broadcast targeting',
      'Instant search by phone number, name, or metadata tags',
      'Bi-directional sync via Developer REST API & webhooks',
    ],
  },
  {
    id: 'automation',
    label: 'Flow Builder',
    icon: GitFork,
    title: 'Visual Interactive Conversational Automation',
    tagline: 'Design customer self-service workflows with intuitive drag-and-drop nodes.',
    description:
      'Build 24/7 lead qualification funnels, menu navigations, automated order lookups, and keyword triggers without writing a single line of backend code.',
    bullets: [
      'Interactive WhatsApp buttons, list pickers, and media nodes',
      'Keyword detection with fuzzy matching and fallback handlers',
      'Branching conditions based on contact attributes or input',
      'Live run session debugger with node-by-node execution logs',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    title: 'Actionable Performance & Conversation Analytics',
    tagline: 'Track response times, message volume, and team performance metrics.',
    description:
      'Gain full visibility into customer demand patterns, peak messaging hours, agent resolution speed, and campaign conversion rates in real time.',
    bullets: [
      'Hourly and daily message volume breakdowns',
      'First response time (FRT) and mean resolution time tracking',
      'Agent productivity logs and conversation resolution counts',
      'Campaign read-rate and deliverability benchmarks',
    ],
  },
];

export function MarketingProductShowcase() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('inbox');
  const current = MODULES.find((m) => m.id === activeModule) || MODULES[0];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <Badge
          variant="outline"
          className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
        >
          Product Workflows
        </Badge>
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Everything You Need to Run WhatsApp at Scale
        </h2>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground">
          Purpose-built operational tools for customer success agents, sales reps, and growth teams.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {MODULES.map((m) => {
          const isActive = m.id === activeModule;
          return (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`flex items-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <m.icon className="h-4 w-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Showcase Card Display */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-10 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text / Specs */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize text-xs">
                {current.label}
              </Badge>
              <span className="text-xs text-muted-foreground">• Live Platform Workflow</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {current.title}
            </h3>

            <p className="text-base text-primary font-medium">{current.tagline}</p>

            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

            <ul className="space-y-3 pt-2">
              {current.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Realistic Interactive Preview */}
          <div className="lg:col-span-6 rounded-xl border border-border/70 bg-background/80 p-4 sm:p-6 shadow-inner font-mono text-xs">
            {activeModule === 'inbox' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Shared Live Inbox</span>
                  <span className="text-emerald-500 font-medium">● 3 Agents Online</span>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground text-xs">Elena R. (Support Agent)</span>
                    <span className="text-[10px] text-primary font-medium">Assigned</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    &quot;Applying tag [Enterprise Lead] and sharing API documentation.&quot;
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                  <span className="text-[10px] text-primary font-semibold uppercase">Customer Message</span>
                  <p className="text-xs text-foreground">
                    &quot;We are evaluating your CRM to replace our single-phone setup. How many seats are included?&quot;
                  </p>
                </div>
              </div>
            )}

            {activeModule === 'campaigns' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Broadcast Dispatch Monitor</span>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                    Active Dispatch
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Q4 Subscriber Promotion</span>
                    <span className="text-muted-foreground font-mono">4,920 / 5,000</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full w-[98.4%]" />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Delivered: 98.4%</span>
                    <span>Read: 82.6%</span>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'templates' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Meta Template Manager</span>
                  <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                    APPROVED
                  </Badge>
                </div>
                <div className="p-3.5 rounded-lg bg-card border border-border/60 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-primary font-bold">order_dispatch_update</span>
                    <span className="text-[10px] text-muted-foreground font-mono">en_US</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    &quot;Hi &#123;&#123;customer_name&#125;&#125;, order #&#123;&#123;order_id&#125;&#125; has shipped! Track package details below:&quot;
                  </p>
                  <div className="pt-2 flex flex-col gap-1.5 text-center">
                    <div className="rounded border border-primary/40 bg-primary/5 py-1 text-[11px] text-primary font-medium">
                      Button: [ Track Delivery Status ]
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'contacts' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Customer Profile CRM</span>
                  <Badge variant="secondary" className="text-[10px]">Verified Number</Badge>
                </div>
                <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">Marcus Sterling</span>
                    <span className="font-mono text-muted-foreground text-[11px]">+44 7911 123456</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">
                      Enterprise Tier
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      Subscribed via CSV
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'automation' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Flow Canvas: Customer Inbound</span>
                  <Badge variant="outline" className="text-[10px]">Active</Badge>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded-lg border border-border/60 bg-card text-xs flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="font-medium text-foreground">Trigger: Keyword &quot;/start&quot;</span>
                  </div>
                  <div className="pl-4 border-l-2 border-primary/40 py-1 space-y-2">
                    <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 text-xs flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium text-foreground">Action: Send Button Menu</span>
                    </div>
                    <div className="p-2 rounded-lg border border-border/60 bg-card text-xs flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-medium text-foreground">Condition: Branch by Selection</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'analytics' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-border/50 pb-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Real-Time Queue Telemetry</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Last 24 Hours</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-card border border-border/60">
                    <span className="text-[11px] text-muted-foreground">First Response Time</span>
                    <p className="text-xl font-bold text-foreground mt-1 font-mono">1m 42s</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border/60">
                    <span className="text-[11px] text-muted-foreground">Resolution Rate</span>
                    <p className="text-xl font-bold text-emerald-500 mt-1 font-mono">94.8%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
