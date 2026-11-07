'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

type Chapter = {
  id: string;
  title: string;
  body: string;
  visual: React.ReactNode;
};

/* ----------------------------- Illustrations ----------------------------- */

function InboxVisual() {
  const rows = [
    { name: 'Aarav Mehta', msg: 'Can you deliver by Friday?', who: 'RS', unread: 2 },
    { name: 'Sneha Kulkarni', msg: 'Thanks, received the order', who: 'AK', unread: 0 },
    { name: 'Imran Shaikh', msg: 'What is the price for 50 units?', who: 'RS', unread: 1 },
    { name: 'Neha Iyer', msg: 'Please share the invoice', who: '—', unread: 3 },
  ];
  return (
    <ul className="divide-y divide-[var(--lp-line)]">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-sm font-semibold">
            {r.name
              .split(' ')
              .map((p) => p[0])
              .join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--lp-ink)]">{r.name}</p>
            <p className="truncate text-sm text-[var(--lp-mute)]">{r.msg}</p>
          </div>
          <span
            className="rounded-full border border-[var(--lp-line)] px-2 py-0.5 text-[11px] text-[var(--lp-mute)]"
            title={r.who === '—' ? 'Unassigned' : 'Assigned agent'}
          >
            {r.who === '—' ? 'Unassigned' : r.who}
          </span>
          {r.unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {r.unread}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FlowVisual() {
  const nodes = [
    { t: 'When a message contains', d: '“price” or “rate”' },
    { t: 'Send', d: 'Product catalogue (PDF)' },
    { t: 'Ask', d: 'Which size do you need?' },
    { t: 'If no reply in 10 min', d: 'Assign to a sales agent' },
  ];
  return (
    <div className="flex flex-col items-center gap-0 px-6 py-8">
      {nodes.map((n, i) => (
        <div key={n.t} className="flex w-full max-w-sm flex-col items-center">
          <div className="w-full rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-raised)] px-4 py-3">
            <p className="text-xs text-[var(--lp-mute)]">{n.t}</p>
            <p className="text-sm font-medium text-[var(--lp-ink)]">{n.d}</p>
          </div>
          {i < nodes.length - 1 && <div className="h-6 w-px bg-[var(--lp-line)]" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

function BroadcastVisual() {
  const bars = [
    { label: 'Sent', value: 100 },
    { label: 'Delivered', value: 96 },
    { label: 'Read', value: 71, read: true },
  ];
  return (
    <div className="px-6 py-8">
      <div className="rounded-2xl bg-[var(--lp-bubble)] p-4">
        <p className="text-sm text-[var(--lp-ink)]">
          Hi {'{{name}}'}, our festive collection is live. Reply “SHOW” to see this week’s offers.
        </p>
        <p className="mt-2 text-xs text-[var(--lp-mute)]">Approved template, scheduled for Fri 7:00 pm</p>
      </div>
      <div className="mt-6 space-y-4">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-[var(--lp-ink)]">{b.label}</span>
              <span className="text-[var(--lp-mute)]">{b.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--muted)]">
              <div
                className="h-2 rounded-full"
                style={{ width: `${b.value}%`, background: b.read ? 'var(--lp-read)' : 'var(--primary)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportVisual() {
  const days = [38, 52, 47, 64, 58, 81, 73];
  const max = Math.max(...days);
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="px-6 py-8">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--lp-line)] p-4">
          <p className="text-xs text-[var(--lp-mute)]">Median first reply</p>
          <p className="lp-section-title mt-1 text-2xl">2 min</p>
        </div>
        <div className="rounded-2xl border border-[var(--lp-line)] p-4">
          <p className="text-xs text-[var(--lp-mute)]">Chats this week</p>
          <p className="lp-section-title mt-1 text-2xl">413</p>
        </div>
      </div>
      <div className="mt-6 flex h-36 items-end gap-2" role="img" aria-label="Chats per day this week">
        {days.map((d, i) => (
          <div key={names[i]} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="w-full rounded-md bg-primary/80" style={{ height: `${(d / max) * 100}%` }} />
            <span className="text-[11px] text-[var(--lp-mute)]">{names[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const chapters: Chapter[] = [
  {
    id: 'inbox',
    title: 'One inbox the whole team shares',
    body: 'Every chat from every number lands in one place. Assign conversations, leave private notes and see who replied, so no customer waits twice.',
    visual: <InboxVisual />,
  },
  {
    id: 'automate',
    title: 'Answers while you sleep',
    body: 'Build chatbot flows by dragging blocks: share the catalogue, take orders, and hand the chat to a person when it needs one.',
    visual: <FlowVisual />,
  },
  {
    id: 'broadcast',
    title: 'Broadcasts people actually read',
    body: 'Send approved templates to a phonebook or a label, schedule them for later, and watch delivery and read receipts come in.',
    visual: <BroadcastVisual />,
  },
  {
    id: 'measure',
    title: 'Know what is working',
    body: 'See reply times, campaign results and agent workload for any date range, for each WhatsApp number.',
    visual: <ReportVisual />,
  },
];

export function MessageJourney() {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // Pinned scrolling only on large screens with motion allowed; otherwise everything is stacked
  const [pinned, setPinned] = useState(false);

  // The pinned layout becomes visible only after this state flips; re-measure then
  useEffect(() => {
    if (pinned) ScrollTrigger.refresh();
  }, [pinned]);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      setPinned(true);
      const st = ScrollTrigger.create({
        trigger: section.current,
        start: 'top top',
        end: () => `+=${window.innerHeight * (chapters.length - 0.4)}`,
        pin: '.lp-journey-pin',
        pinSpacing: true,
        onUpdate: (self) => {
          const i = Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length));
          setActive(i);
        },
      });
      return () => {
        st.kill();
        setPinned(false);
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="journey" ref={section} aria-labelledby="lp-journey-title" className="relative">
      {/* Desktop: pinned, scroll steps through the chapters */}
      <div className={cn('lp-journey-pin min-h-screen items-center', pinned ? 'flex' : 'hidden')}>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-12 gap-10 px-8">
          <div className="col-span-5 flex flex-col justify-center">
            <h2 id="lp-journey-title" className="lp-section-title max-w-md text-5xl text-[var(--lp-ink)]">
              What happens after a customer says hi
            </h2>
            <ol className="mt-10 space-y-2">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <div
                    className={cn(
                      'border-l-2 py-3 pl-5 transition-colors duration-300',
                      i === active ? 'border-primary' : 'border-[var(--lp-line)]',
                    )}
                    aria-current={i === active ? 'step' : undefined}
                  >
                    <h3
                      className={cn(
                        'text-lg font-semibold transition-colors duration-300',
                        i === active ? 'text-[var(--lp-ink)]' : 'text-[var(--lp-mute)]',
                      )}
                    >
                      {c.title}
                    </h3>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows,opacity] duration-500',
                        i === active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <p className="overflow-hidden pt-1.5 text-[15px] leading-relaxed text-[var(--lp-mute)]">{c.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-7">
            <div className="relative h-[520px] overflow-hidden rounded-[28px] border border-[var(--lp-line)] bg-[var(--lp-raised)]">
              {chapters.map((c, i) => (
                <div
                  key={c.id}
                  aria-hidden={i !== active}
                  className={cn(
                    'absolute inset-0 flex flex-col justify-center transition-[opacity,transform]',
                    // outgoing panel leaves quickly, incoming one waits for it: no overlapping text
                    i === active
                      ? 'translate-y-0 opacity-100 delay-150 duration-500'
                      : 'pointer-events-none translate-y-3 opacity-0 delay-0 duration-150',
                  )}
                >
                  {c.visual}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: simple stacked chapters */}
      <div className={cn('mx-auto max-w-2xl px-4 py-20 sm:px-6', pinned && 'hidden')}>
        <h2 className="lp-section-title text-4xl text-[var(--lp-ink)]">What happens after a customer says hi</h2>
        <div className="mt-10 space-y-12">
          {chapters.map((c) => (
            <article key={c.id}>
              <h3 className="text-xl font-semibold text-[var(--lp-ink)]">{c.title}</h3>
              <p className="mt-2 leading-relaxed text-[var(--lp-mute)]">{c.body}</p>
              <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--lp-line)] bg-[var(--lp-raised)]">
                {c.visual}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
