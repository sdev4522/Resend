'use client';

import React from 'react';
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from '@/components/ui/marquee';
import {
  MessageSquare,
  Send,
  Users,
  Radio,
  GitFork,
  Bot,
  Zap,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react';

const CAPABILITIES = [
  { label: 'Official Meta Cloud API', icon: Radio },
  { label: 'Multi-Agent Team Inbox', icon: MessageSquare },
  { label: 'Template Broadcast Campaigns', icon: Send },
  { label: 'Dynamic Variable Merging', icon: Zap },
  { label: 'Contact CRM & CSV Import', icon: Users },
  { label: 'Keyword Auto-Replies', icon: Bot },
  { label: 'Visual Flow Automation', icon: GitFork },
  { label: 'Meta-Approved Templates', icon: FileText },
  { label: 'Webhooks & REST API', icon: ShieldCheck },
  { label: 'Real-Time WebSocket Sync', icon: Clock },
  { label: '14-Day Free Trial', icon: CheckCircle2 },
];

export function MarketingCapabilityMarquee() {
  return (
    <section
      aria-label="Supported Product Capabilities"
      className="border-y border-border/50 bg-muted/20 py-4 overflow-hidden"
    >
      <ScrollVelocityContainer>
        <ScrollVelocityRow className="[--duration:50s]">
          {CAPABILITIES.map((item) => (
            <div
              key={item.label}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-xs font-medium text-foreground/80 shadow-2xs backdrop-blur-xs transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <item.icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{item.label}</span>
            </div>
          ))}
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
    </section>
  );
}
