'use client';

import { cn } from '@/lib/utils';

type Chapter = {
  id: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  /** Grid placement in the bento + the tint of its illustration well */
  span: string;
  tint: string;
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
          <div key={names[i]} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div className="w-full rounded-md bg-primary/80" style={{ height: `${(d / max) * 100}%` }} />
            </div>
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
    span: 'md:col-span-2',
    tint: 'var(--lp-glow-mint)',
  },
  {
    id: 'automate',
    title: 'Answers while you sleep',
    body: 'Build chatbot flows by dragging blocks: share the catalogue, take orders, and hand the chat to a person when it needs one.',
    visual: <FlowVisual />,
    span: '',
    tint: 'var(--lp-glow-lilac)',
  },
  {
    id: 'broadcast',
    title: 'Broadcasts people actually read',
    body: 'Send approved templates to a phonebook or a label, schedule them for later, and watch delivery and read receipts come in.',
    visual: <BroadcastVisual />,
    span: '',
    tint: 'var(--lp-glow-sky)',
  },
  {
    id: 'measure',
    title: 'Know what is working',
    body: 'See reply times, campaign results and agent workload for any date range, for each WhatsApp number.',
    visual: <ReportVisual />,
    span: 'md:col-span-2',
    tint: 'var(--lp-glow-peach)',
  },
];

export function MessageJourney() {
  return (
    <section id="journey" aria-labelledby="lp-journey-title" className="relative isolate overflow-hidden py-24 lg:py-28">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="lp-glow left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 bg-[var(--lp-glow-lilac)] opacity-40" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="lp-journey-title" className="lp-section-title text-4xl text-[var(--lp-ink)] md:text-[3.25rem]">
            What happens after a customer says hi
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--lp-mute)]">
            Inbox, chatbots, broadcasts and reports share the same contacts, so nothing gets lost between them.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {chapters.map((c) => (
            <article
              key={c.id}
              className={cn(
                'flex flex-col overflow-hidden rounded-[28px] border border-[var(--lp-line)] bg-[var(--lp-raised)] shadow-[var(--lp-shadow)]',
                c.span,
              )}
            >
              <div className="p-7 pb-5">
                <h3 className="text-xl font-semibold tracking-tight text-[var(--lp-ink)]">{c.title}</h3>
                <p className="mt-2 max-w-md leading-relaxed text-[var(--lp-mute)]">{c.body}</p>
              </div>
              <div
                className="mx-3 mb-3 flex flex-1 flex-col justify-center rounded-[20px] p-3"
                style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${c.tint} 55%, transparent), color-mix(in oklab, ${c.tint} 15%, transparent))` }}
              >
                <div className="overflow-hidden rounded-2xl border border-white/70 bg-[var(--lp-raised)] shadow-[var(--lp-shadow)] dark:border-white/10">
                  {c.visual}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
