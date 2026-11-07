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
import { Check, X, ShieldCheck, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

interface CompetitorRow {
  capability: string;
  description: string;
  resend: string;
  resendHighlight: boolean;
  wati: string;
  aisensy: string;
  whatsappApp: string;
}

const COMPETITOR_COMPARISON_DATA: CompetitorRow[] = [
  {
    capability: 'Concurrent Multi-Agent Team Inbox',
    description: 'Multiple support or sales agents replying simultaneously from the same verified WhatsApp number.',
    resend: 'Unlimited seats & live routing',
    resendHighlight: true,
    wati: 'Plan-dependent team seats',
    aisensy: 'Plan-dependent agents',
    whatsappApp: 'Single session (disconnects others)',
  },
  {
    capability: 'WhatsApp Connection Engine',
    description: 'Official Meta Graph Cloud API plus rapid QR code device pairing.',
    resend: 'Official Cloud API + QR Engine',
    resendHighlight: true,
    wati: 'Meta Cloud API only',
    aisensy: 'Meta Cloud API only',
    whatsappApp: 'Mobile phone app only',
  },
  {
    capability: 'Bulk Template Broadcasts',
    description: 'Sending personalized template broadcasts with delivery tracking and rate-limiting.',
    resend: 'Advanced segmented campaigns',
    resendHighlight: true,
    wati: 'Broadcast campaign manager',
    aisensy: 'Campaign scheduling tools',
    whatsappApp: 'Capped at 256 contacts / chat',
  },
  {
    capability: 'Visual No-Code Chatbot Flows',
    description: 'Automated conversational routing, keyword triggers, and interactive button pickers.',
    resend: 'Visual node builder & keywords',
    resendHighlight: true,
    wati: 'Chatbot builder included',
    aisensy: 'Flow builder available',
    whatsappApp: 'Basic away message only',
  },
  {
    capability: 'Private Internal Agent Notes',
    description: 'Internal team notes within customer conversations invisible to the end user.',
    resend: 'Built-in internal notes',
    resendHighlight: true,
    wati: 'Supported',
    aisensy: 'Supported',
    whatsappApp: 'Not available',
  },
  {
    capability: 'Contact CRM & Custom Attributes',
    description: 'Customer data organization with dynamic tags, custom fields, and bulk CSV import.',
    resend: 'Unlimited custom attributes',
    resendHighlight: true,
    wati: 'Contact list management',
    aisensy: 'Contact attributes & tags',
    whatsappApp: 'Phone address book only',
  },
  {
    capability: 'Developer REST API & Inbound Webhooks',
    description: 'Programmable API keys, webhook event payloads, and transactional message dispatch.',
    resend: 'HMAC-verified REST API',
    resendHighlight: true,
    wati: 'Developer API available',
    aisensy: 'API integrations supported',
    whatsappApp: 'No programmable API',
  },
  {
    capability: 'Transparent SaaS Pricing',
    description: 'Predictable pricing model without hidden markup on conversation limits.',
    resend: 'Transparent flat tiers & trial',
    resendHighlight: true,
    wati: 'Per-user / tier pricing',
    aisensy: 'Per-message markup tiers',
    whatsappApp: 'Free app (unsupported for teams)',
  },
];

export function CompetitorComparison() {
  const { openRegister } = useAuthDialog();

  return (
    <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <Badge
          variant="outline"
          className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
        >
          Market Comparison
        </Badge>
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Resend vs. WATI vs. AiSensy
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Compare official WhatsApp Cloud API platforms based on multi-agent collaboration, automation flexibility, and pricing transparency.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/30 hover:bg-muted/30">
              <TableHead className="py-4 px-6 text-sm font-semibold text-foreground w-[28%]">
                Feature / Capability
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-primary w-[24%] bg-primary/5 border-x border-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-bold">Resend</span>
                </div>
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-muted-foreground w-[18%]">
                WATI
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-muted-foreground w-[18%]">
                AiSensy
              </TableHead>
              <TableHead className="py-4 px-6 text-sm font-semibold text-muted-foreground w-[12%]">
                WhatsApp App
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPETITOR_COMPARISON_DATA.map((row) => (
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
                    <span className="text-foreground text-xs sm:text-sm font-bold">
                      {row.resend}
                    </span>
                  </div>
                </TableCell>

                {/* WATI */}
                <TableCell className="py-4 px-6 text-muted-foreground text-xs whitespace-normal">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{row.wati}</span>
                  </div>
                </TableCell>

                {/* AiSensy */}
                <TableCell className="py-4 px-6 text-muted-foreground text-xs whitespace-normal">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{row.aisensy}</span>
                  </div>
                </TableCell>

                {/* WhatsApp App */}
                <TableCell className="py-4 px-6 text-muted-foreground text-xs whitespace-normal">
                  <div className="flex items-center gap-1.5">
                    <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="text-muted-foreground">{row.whatsappApp}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Footer info & research methodology note */}
        <div className="border-t border-border/70 bg-muted/20 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Research verified against official WATI &amp; AiSensy documentation (Research Date: Q4 2026).</span>
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

      {/* Competitor Research Source Note */}
      <div className="mt-6 text-center">
        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <span>Competitor feature comparison compiled from public pricing and documentation pages.</span>
          <a
            href="https://www.wati.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1"
          >
            WATI docs <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-muted-foreground">·</span>
          <a
            href="https://aisensy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            AiSensy docs <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </section>
  );
}
