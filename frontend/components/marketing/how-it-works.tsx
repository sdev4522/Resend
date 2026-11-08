'use client';

import React from 'react';
import { RevealText, trackSpot } from '@/components/marketing/landing/reveal-text';

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
    <section id="how-it-works" aria-labelledby="hiw-title" className="relative isolate overflow-hidden py-24 lg:py-28">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[var(--lp-sunk)]">
        <div className="lp-glow -left-40 top-10 h-[380px] w-[520px] bg-[var(--lp-glow-mint)] opacity-60" />
        <div className="lp-glow -right-40 bottom-0 h-[380px] w-[520px] bg-[var(--lp-glow-sky)] opacity-60" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <RevealText
            id="hiw-title"
            text="Set up in an afternoon"
            className="lp-section-title text-4xl text-[var(--lp-ink)] md:text-[3.25rem]"
          />
          <p className="mt-5 text-lg leading-relaxed text-[var(--lp-mute)]">
            No developer needed. Three steps from sign-up to your first reply.
          </p>
        </div>

        <ol className="mt-16 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              onMouseMove={trackSpot}
              className="lp-spot group flex flex-col rounded-[28px] border border-white/80 bg-white/75 p-8 shadow-[var(--lp-shadow)] backdrop-blur-md dark:border-white/10 dark:bg-[var(--lp-raised)]/80"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--lp-ink)] text-base font-semibold text-[var(--lp-paper)] transition-[background-color,transform] duration-300 group-hover:-rotate-6 group-hover:bg-primary group-hover:text-primary-foreground"
              >
                {i + 1}
              </span>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-[var(--lp-ink)]">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-[var(--lp-mute)]">{s.description}</p>
              <p className="mt-auto border-t border-[var(--lp-line)] pt-5 text-sm text-[var(--lp-mute)]">{s.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
