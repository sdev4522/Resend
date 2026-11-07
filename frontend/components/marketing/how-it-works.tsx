'use client';

import React from 'react';

const STEPS = [
  {
    title: 'Connect your number',
    description:
      'Scan a QR code with your phone and you are live in about a minute. For higher volumes, connect the official WhatsApp Cloud API instead.',
    note: 'QR works right away. The Cloud API needs Meta to verify your business first.',
  },
  {
    title: 'Bring your customers in',
    description:
      'Import contacts from a CSV file, group them into phonebooks, and add labels such as “Wholesale” or “Repeat buyers”.',
    note: 'Your plan sets how many contacts you can store.',
  },
  {
    title: 'Reply, automate, broadcast',
    description:
      'Your team answers from one inbox, chatbots handle the routine questions, and broadcasts go out when you schedule them.',
    note: 'Broadcasts use message templates approved by Meta.',
  },
];

export function MarketingHowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="hiw-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h2 id="hiw-title" className="lp-section-title text-4xl text-foreground md:text-5xl">
          Set up in an afternoon
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          No developer needed. Three steps from sign-up to your first reply.
        </p>
      </div>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-border bg-border lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col bg-card p-7 sm:p-9">
            <span
              aria-hidden="true"
              className="lp-display text-6xl text-primary/90"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {i + 1}
            </span>
            <h3 className="mt-8 text-xl font-semibold text-foreground">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{s.description}</p>
            <p className="mt-auto pt-8 text-sm text-muted-foreground/90">{s.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
