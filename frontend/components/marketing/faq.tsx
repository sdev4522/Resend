'use client';

import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  ShieldCheck,
  Users,
  Radio,
  Send,
  Code2,
  Clock,
  FileText,
  ArrowRight,
  Receipt,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    icon: MessageSquare,
    question: 'How do I get started with Resend?',
    answer:
      'Getting started takes under 5 minutes. Sign up for a free 14-day trial, create your workspace, and choose your preferred WhatsApp connection method (Meta Cloud API or instant QR scan). You can immediately start inviting agents and receiving conversations.',
  },
  {
    icon: Radio,
    question: 'What is required to connect WhatsApp?',
    answer:
      'For Meta Cloud API, you need a Meta Business Account and a phone number not currently registered on personal WhatsApp. For our QR engine, you simply scan a QR code with any active WhatsApp or WhatsApp Business number on your phone.',
  },
  {
    icon: ShieldCheck,
    question: 'What is the difference between Meta Cloud API and QR-based connections?',
    answer:
      'Meta Cloud API connects directly via Meta’s enterprise infrastructure, ensuring official policy compliance, high message throughput, and zero phone battery/connectivity dependency. The QR engine allows instant plug-and-play connection without waiting for business verification.',
  },
  {
    icon: Receipt,
    question: 'Are there additional charges from Meta for WhatsApp conversations?',
    answer:
      'Yes, if you use the official Meta Cloud API. Meta charges for WhatsApp conversations based on categories (Marketing, Utility, Authentication, and Service). Service conversations (customer-initiated inquiries) include 1,000 free conversations per month per Meta Business Account. Resend subscription plans cover software access, team seats, and platform tools, while Meta conversation fees are paid directly to Meta via your Meta Business Manager payment method. If you connect via our QR scan engine, messages use your regular mobile plan without Meta conversation charges.',
  },
  {
    icon: FileText,
    question: 'Are WhatsApp templates subject to approval?',
    answer:
      'Yes. Outbound broadcast messages initiated by the business must use Meta-approved templates per WhatsApp Business policy. You can create, edit, and submit templates directly within Resend, and Meta typically reviews them within minutes to a few hours.',
  },
  {
    icon: Users,
    question: 'Can multiple team members manage conversations from one number?',
    answer:
      'Yes. Your entire team can log in simultaneously with dedicated agent credentials, answer customer queries from the shared number, assign tickets to specific agents, and leave private internal notes without disconnecting other members.',
  },
  {
    icon: Send,
    question: 'How do campaigns and broadcast usage limits work?',
    answer:
      'You can dispatch personalized template broadcasts to segmented contact lists. Broadcast limits follow your Meta Business messaging tier (Tier 1: 1,000 unique recipients/day, Tier 2: 10,000, Tier 3: 100,000). Resend includes built-in rate limiting to protect your account health.',
  },
  {
    icon: Clock,
    question: 'What is included in the 14-day free trial?',
    answer:
      'The 14-day free trial provides full access to our collaborative multi-agent inbox, contact CRM, template management, and automation rules. No credit card is required to sign up, and you can upgrade to a paid tier whenever you are ready.',
  },
  {
    icon: Code2,
    question: 'Does Resend offer a Developer REST API & Webhooks?',
    answer:
      'Yes. Our REST API and HMAC-SHA256 verified inbound webhooks allow you to trigger automated transactional messages, sync contact lists with your CRM, and receive real-time message event payloads into your backend systems.',
  },
];

export function MarketingFAQ({ isPageHeading = false }: { isPageHeading?: boolean } = {}) {
  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3"
          >
            Clear Answers
          </Badge>
          {isPageHeading ? (
            <h1 className="text-3xl xs:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Frequently Asked Questions
            </h1>
          ) : (
            <h2 className="text-3xl xs:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
          )}
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Transparent answers regarding WhatsApp connectivity, multi-agent collaboration, and billing.
          </p>
        </div>

        {/* Real shadcn/ui Accordion */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
          <Accordion defaultValue={['item-0']} className="w-full">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`item-${index}`}
                className="py-1"
              >
                <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline hover:text-primary gap-4 py-4 cursor-pointer">
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pl-11 pr-4 pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Support Link */}
        <div className="mt-12 p-6 rounded-2xl border border-border/70 bg-muted/20 text-center space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            Have a custom requirement or question?
          </h4>
          <p className="text-xs text-muted-foreground">
            Our support and engineering team is available to assist with onboarding and custom API workflows.
          </p>
          <div className="pt-2">
            <a
              href="/contact"
              className="inline-flex items-center text-xs font-semibold text-primary hover:underline gap-1"
            >
              Contact Sales &amp; Support <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
