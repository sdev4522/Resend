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
    <section id="how-it-works" aria-labelledby="hiw-title" className="bg-[var(--lp-bubble)]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <h2 id="hiw-title" className="lp-display text-[clamp(3rem,6vw,4.75rem)] text-[var(--lp-ink)]">
            Set up in an afternoon
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--lp-ink)]/75">
            No developer needed. Three steps from sign-up to your first reply.
          </p>
        </div>

        <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col border-t-[3px] border-[var(--lp-ink)] pt-6">
              <span
                aria-hidden="true"
                className="lp-display text-[5.5rem] leading-[0.8] text-[var(--lp-ink)]"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {i + 1}
              </span>
              <h3 className="mt-6 text-xl font-semibold text-[var(--lp-ink)]">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-[var(--lp-ink)]/80">{s.description}</p>
              <p className="mt-auto pt-6 text-sm text-[var(--lp-ink)]/65">{s.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
