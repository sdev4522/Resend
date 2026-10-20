'use client';

import React from 'react';
import {
  Radio,
  MessageSquare,
  Send,
  Bot,
  Users,
  BarChart3,
} from 'lucide-react';

interface FeatureItem {
  icon: React.ElementType;
  title: string;
  description: string;
  tag: string;
  badge: string;
}

const CORE_FEATURES: FeatureItem[] = [
  {
    icon: Radio,
    title: 'WhatsApp Business API',
    description:
      'Connect via official Meta Cloud API or instant QR engine. Keep your team connected without battery drain, desktop disconnections, or physical phone dependencies.',
    tag: 'Cloud API & QR Engine',
    badge: 'Official Graph API',
  },
  {
    icon: MessageSquare,
    title: 'Shared Team Inbox',
    description:
      'Empower your entire team to manage customer conversations from one shared WhatsApp number. Assign chats, reply in real time, and leave private team notes.',
    tag: 'Multi-Agent Collaboration',
    badge: 'Simultaneous Logins',
  },
  {
    icon: Send,
    title: 'Campaigns & Broadcasts',
    description:
      'Dispatch Meta-approved template broadcasts to segmented contact lists. Personalize dynamic variables and track delivery, read receipts, and replies in real time.',
    tag: 'High Deliverability',
    badge: 'Meta Template Approvals',
  },
  {
    icon: Bot,
    title: 'Chatbots & Auto-Replies',
    description:
      'Answer common customer questions 24/7 with keyword auto-responders and visual flow automation, ensuring inquiries receive immediate assistance.',
    tag: '24/7 Automation',
    badge: 'Visual Flows & Keywords',
  },
  {
    icon: Users,
    title: 'Contact Management & CRM',
    description:
      'Keep customer details organized with custom attributes, dynamic tags, and bulk CSV management so your team can find the right contact and follow up easily.',
    tag: 'Unified Directory',
    badge: 'CSV Import & Custom Tags',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Delivery Logs',
    description:
      'Track message delivery, read receipts, customer response times, and campaign performance with real-time operational logs.',
    tag: 'Live Telemetry',
    badge: 'Real-Time Message Logs',
  },
];

export function MarketingBentoFeatures() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
          Platform Capabilities
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Everything You Need to Run WhatsApp Support and Marketing
        </h2>
        <p className="mt-3.5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Stop juggling multiple phones and losing customer chats. Resend gives your team the tools to respond faster, broadcast updates, and automate repetitive answers.
        </p>
      </div>

      {/* 6 Core Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CORE_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 sm:p-7 shadow-xs hover:border-border transition-colors group"
          >
            <div>
              {/* Icon & Tag */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                  {feature.tag}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-semibold text-foreground tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-primary">Verified Feature</span>
              <span>{feature.badge}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
