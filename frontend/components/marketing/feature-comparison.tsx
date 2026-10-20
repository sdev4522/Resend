'use client';

import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, HelpCircle, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

interface ComparisonRow {
  capability: string;
  description: string;
  resend: 'yes' | 'plan';
  resendLabel: string;
  manual: 'no' | 'limited' | 'capped';
  manualLabel: string;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    capability: 'Concurrent Multi-Agent Logins',
    description: 'Multiple support or sales agents reply simultaneously from the same verified WhatsApp number.',
    resend: 'yes',
    resendLabel: 'Full Multi-Agent Access',
    manual: 'no',
    manualLabel: 'Single Session Disconnections',
  },
  {
    capability: 'Agent Chat Assignment & Accountability',
    description: 'Route conversations to specific team members, track open tickets, and monitor agent performance.',
    resend: 'yes',
    resendLabel: 'Automated & Manual Routing',
    manual: 'no',
    manualLabel: 'No Assignment Mechanism',
  },
  {
    capability: 'Official Meta Cloud API Direct Connection',
    description: 'Direct server-to-server connection through Meta Graph API with enterprise verification compliance.',
    resend: 'yes',
    resendLabel: 'Included (Dual Engine)',
    manual: 'no',
    manualLabel: 'Physical Phone Dependency',
  },
  {
    capability: 'Bulk Audience Broadcast Campaigns',
    description: 'Dispatch verified template broadcasts to thousands of tagged customers with rate-limiting protection.',
    resend: 'yes',
    resendLabel: 'Segmented Audiences',
    manual: 'capped',
    manualLabel: 'Capped at 256 Recipients',
  },
  {
    capability: 'Meta-Approved Template Management',
    description: 'Synchronize, compose, and manage templates with interactive buttons, headers, and approval tracking.',
    resend: 'yes',
    resendLabel: 'Live Sync & Approval',
    manual: 'no',
    manualLabel: 'Unverified Plain Text Only',
  },
  {
    capability: 'Private Internal Agent Notes',
    description: 'Leave internal team notes inside conversations invisible to the customer for seamless handover.',
    resend: 'yes',
    resendLabel: 'Internal Team Notes',
    manual: 'no',
    manualLabel: 'Not Available',
  },
  {
    capability: 'Contact CRM & CSV Bulk Import',
    description: 'Organize customers with custom key-value attributes, dynamic tags, and bulk CSV management.',
    resend: 'yes',
    resendLabel: 'Unlimited Directory & Tags',
    manual: 'limited',
    manualLabel: 'Manual Phonebook Only',
  },
  {
    capability: '24/7 Automated Keyword Chatbots',
    description: 'Instant automated replies, interactive menu buttons, and flow automation for common inquiries.',
    resend: 'plan',
    resendLabel: 'Chatbots & Flow Builder',
    manual: 'limited',
    manualLabel: 'Basic Away Message Only',
  },
  {
    capability: 'Delivery, Read & Failure Telemetry',
    description: 'Real-time message logs with delivery confirmation, read rate benchmarks, and error diagnostics.',
    resend: 'yes',
    resendLabel: 'Real-Time Telemetry Logs',
    manual: 'limited',
    manualLabel: 'Basic Checkmarks Only',
  },
  {
    capability: 'Developer REST API & Inbound Webhooks',
    description: 'Send transactional WhatsApp alerts and receive inbound message payloads into your backend or CRM.',
    resend: 'plan',
    resendLabel: 'API Keys & HMAC Webhooks',
    manual: 'no',
    manualLabel: 'No Programmable API',
  },
];

export function MarketingFeatureComparison() {
  const { openRegister } = useAuthDialog();

  return (
    <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <Badge
          variant="outline"
          className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
        >
          Workflow Comparison
        </Badge>
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Why Teams Upgrade to Resend
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          See how an enterprise WhatsApp CRM platform transforms your day-to-day operations compared to manual WhatsApp app workflows.
        </p>
      </div>

      {/* Comparison Table Container with Real shadcn/ui Table Primitives */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/30 hover:bg-muted/30">
              <TableHead className="py-4 px-6 text-sm font-semibold text-foreground w-[45%]">
                Operational Capability
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-primary w-[30%] bg-primary/5 border-x border-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Resend Platform</span>
                </div>
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-muted-foreground w-[25%]">
                Standard WhatsApp App
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARISON_DATA.map((row) => (
              <TableRow key={row.capability} className="hover:bg-muted/20 transition-colors">
                <TableCell className="py-4 px-6 whitespace-normal">
                  <p className="font-semibold text-foreground text-sm">{row.capability}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {row.description}
                  </p>
                </TableCell>

                {/* Resend Cell */}
                <TableCell className="py-4 px-6 bg-primary/5 border-x border-border/60 font-medium whitespace-normal">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                    <span className="text-foreground text-xs sm:text-sm font-medium">
                      {row.resendLabel}
                    </span>
                  </div>
                </TableCell>

                {/* Manual App Cell */}
                <TableCell className="py-4 px-6 text-muted-foreground font-normal whitespace-normal">
                  <div className="flex items-center gap-2">
                    {row.manual === 'no' ? (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <X className="h-3.5 w-3.5 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {row.manualLabel}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Bottom CTA bar */}
        <div className="border-t border-border/70 bg-muted/20 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Includes 14-day free trial on all plans. No credit card required.</span>
          </div>
          <Button
            size="sm"
            onClick={openRegister}
            className="rounded-full px-6 text-xs font-semibold cursor-pointer shrink-0"
          >
            Start Free Trial
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
