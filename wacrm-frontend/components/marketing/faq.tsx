'use client';

import React from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  Users,
  CreditCard,
  Radio,
  Send,
  Code2,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FAQ_ITEMS = [
  {
    icon: MessageSquare,
    question: 'What is WaCRM?',
    answer:
      'WaCRM is an official B2B customer relationship management and team inbox platform for WhatsApp. It allows teams to consolidate WhatsApp conversations, automate routine interactions, run broadcast campaigns, and collaborate seamlessly from a single workspace.',
  },
  {
    icon: Radio,
    question: 'How does WhatsApp integration work?',
    answer:
      'WaCRM supports direct integration with Meta’s official WhatsApp Business Cloud API for enterprise deliverability and high message limits. For businesses with existing numbers, we also offer high-speed QR instance connectivity for rapid setup.',
  },
  {
    icon: Users,
    question: 'Can multiple agents respond from the same number?',
    answer:
      'Yes. Your entire team can log in simultaneously, view shared customer conversations, assign chats to specific agents, add internal collaboration notes, and reply without disconnecting other agents.',
  },
  {
    icon: ShieldCheck,
    question: 'Can I connect multiple WhatsApp numbers?',
    answer:
      'Depending on your subscription tier, you can connect multiple official WhatsApp numbers to one central workspace and route incoming conversations by department (e.g. Sales, Support, Operations).',
  },
  {
    icon: Radio,
    question: 'What is the difference between Cloud API and QR instances?',
    answer:
      'The Meta Cloud API connects directly through Meta’s servers, ensuring official verification, zero dependency on a physical phone, and unlimited scalability. QR instances allow quick connection of standard WhatsApp accounts without undergoing business verification.',
  },
  {
    icon: Send,
    question: 'Can I send marketing broadcasts and campaigns?',
    answer:
      'Yes. You can broadcast Meta-approved template messages to segmented contact lists. WaCRM includes built-in rate limiting and delivery pacing to protect your account health and reputation.',
  },
  {
    icon: Zap,
    question: 'Can I automate conversations without code?',
    answer:
      'Yes. Our visual Flow Builder and keyword chatbot rules enable you to create automated multi-step decision trees, menu options, button replies, and conditional branches with an intuitive visual editor.',
  },
  {
    icon: Code2,
    question: 'Does WaCRM have a Developer REST API?',
    answer:
      'Yes. Our public REST API (v1) and HMAC-SHA256 verified webhooks allow you to send messages, manage contacts, query analytics, and trigger external workflows from your internal systems, CRM, or e-commerce store.',
  },
  {
    icon: CreditCard,
    question: 'How does billing work and can I cancel?',
    answer:
      'Billing is transparent and calculated using real-time SaaS rates. You can choose monthly or annual billing directly from your workspace dashboard, and upgrade, downgrade, or cancel your subscription at any time with prorated adjustments.',
  },
  {
    icon: Clock,
    question: 'How does the free trial work?',
    answer:
      'New workspaces receive a 10-day trial with full access to test the multi-agent inbox, connect a WhatsApp number, build automated chatbot rules, and explore all core capabilities before committing.',
  },
];

export function MarketingFAQ() {
  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="outline" className="text-xs font-semibold py-1 px-3 border-primary/30 text-primary bg-primary/5 mb-3">
            Got Questions?
          </Badge>
          <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            Clear, honest answers about our WhatsApp integration, multi-agent collaboration, and billing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item.question}
              className="rounded-2xl border border-border/60 bg-card p-6 space-y-3 hover:border-foreground/20 transition-colors"
            >
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <item.icon className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-base text-foreground leading-snug">
                {item.question}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        {/* Support Link */}
        <div className="mt-12 p-6 rounded-2xl border border-border/60 bg-muted/20 text-center space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            Have a question not listed here?
          </h4>
          <p className="text-xs text-muted-foreground">
            Our engineering and customer support team is available to assist with custom integrations.
          </p>
          <div className="pt-2">
            <a
              href="/contact"
              className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
            >
              Contact Support &amp; Sales →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
