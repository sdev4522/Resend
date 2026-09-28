'use client';

import React from 'react';
import { Headphones, TrendingUp, Megaphone, Users, Bot, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UseCase {
  icon: any;
  category: string;
  problem: string;
  solution: string;
  outcome: string;
}

const USE_CASES: UseCase[] = [
  {
    icon: Headphones,
    category: 'Customer Support Teams',
    problem:
      'Support teams juggle physical phones or browser sessions that log each other out, leading to slow replies and lost conversations.',
    solution:
      'WaCRM consolidates official WhatsApp numbers into a shared multi-agent workspace with live chat assignment, resolution statuses, and canned templates.',
    outcome:
      'Eliminate duplicate responses, establish clear agent accountability, and cut first-response times from hours to minutes.',
  },
  {
    icon: TrendingUp,
    category: 'B2B Sales & Inbound Leads',
    problem:
      'High-intent inbound leads drop off when directed to slow email forms or delayed callback requests.',
    solution:
      'Capture leads directly on WhatsApp, qualify their requirements via interactive chatbot buttons, and instantly route qualified leads to the assigned sales rep.',
    outcome:
      'Engage prospective customers in real time where they already communicate, accelerating qualification and discovery calls.',
  },
  {
    icon: Megaphone,
    category: 'Marketing & Product Broadcasts',
    problem:
      'Email marketing open rates continue to decline, while informal WhatsApp broadcasting risks sudden number bans.',
    solution:
      'Deploy official Meta-approved template broadcasts with rate limiting, variable personalization, and segmented recipient tags.',
    outcome:
      'Achieve verifiable delivery rates across verified customer databases without compromising phone number standing.',
  },
  {
    icon: Bot,
    category: '24/7 Conversational Automation',
    problem:
      'Common repetitive questions (store hours, order status, return policies) overwhelm human agents during off-hours.',
    solution:
      'Deploy visual chatbot flows and keyword triggers that handle immediate answers, list pickers, and automated resolution paths.',
    outcome:
      'Resolve standard inquiries automatically while reserving human agents for complex escalations.',
  },
  {
    icon: Users,
    category: 'Agencies & Multi-Client Operations',
    problem:
      'Agencies managing WhatsApp for multiple clients suffer from account credential leakage and cross-client data confusion.',
    solution:
      'Multi-workspace isolation allows agencies to run independent client numbers, dedicated team seats, and separate billing accounts.',
    outcome:
      'Keep client assets strictly isolated with individual audit logs, webhook endpoints, and tailored subscription tiers.',
  },
  {
    icon: Layers,
    category: 'E-Commerce & Developer Integrations',
    problem:
      'Order dispatch updates, OTPs, and payment receipts are disconnected from the primary CRM and communication tools.',
    solution:
      'Our developer REST API and secure webhook events enable two-way sync with Shopify, WooCommerce, or custom backend services.',
    outcome:
      'Automate transactional notifications directly through WhatsApp and allow support agents to view order context in real time.',
  },
];

export function MarketingUseCases() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <Badge variant="outline" className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3">
          Practical Applications
        </Badge>
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Built for Everyday Business Operations
        </h2>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground">
          See how companies use WaCRM to solve communication bottlenecks and scale team output.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {USE_CASES.map((uc) => (
          <div
            key={uc.category}
            className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-6 sm:p-7 hover:border-foreground/20 transition-colors space-y-4"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <uc.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-foreground">{uc.category}</h3>

              <div className="mt-4 space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-destructive/90 uppercase tracking-wider text-[10px]">
                    The Problem
                  </span>
                  <p className="text-muted-foreground mt-0.5">{uc.problem}</p>
                </div>

                <div>
                  <span className="font-semibold text-primary uppercase tracking-wider text-[10px]">
                    The WaCRM Solution
                  </span>
                  <p className="text-foreground/90 mt-0.5">{uc.solution}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                Business Outcome
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{uc.outcome}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
