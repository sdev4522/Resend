'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bot, Clock3, Megaphone, StickyNote, Tag, UserCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RevealText } from './reveal-text';

/**
 * "Be the customer" demo: pick a message, watch the WhatsApp reply arrive and,
 * next to it, what Resend did behind the scenes. Replaces the static bento.
 * The first story is rendered complete, so there is never an empty state.
 */

type Step =
  | { kind: 'in' | 'out'; text: string; time: string; by?: string }
  | { kind: 'log'; icon: LucideIcon; title: string; detail: string };

type Story = { id: string; pick: string; steps: Step[] };

const STORIES: Story[] = [
  {
    id: 'price',
    pick: 'What is the price for 50 units?',
    steps: [
      { kind: 'in', text: 'What is the price for 50 units?', time: '11:02' },
      { kind: 'log', icon: Bot, title: 'Chatbot spotted “price”', detail: 'It starts the flow you built for price questions.' },
      { kind: 'out', by: 'Chatbot', text: 'Happy to help! Our catalogue is on its way. Which size do you need?', time: '11:02' },
      { kind: 'in', text: 'Medium', time: '11:03' },
      { kind: 'log', icon: Tag, title: 'Labelled “Wholesale”', detail: 'Use the label later to pick who gets a broadcast.' },
      { kind: 'out', by: 'Chatbot', text: 'Thanks. Rohan from sales will send your quote here.', time: '11:03' },
      { kind: 'log', icon: UserCheck, title: 'Assigned to Rohan', detail: 'Rohan sees the whole chat, so you never repeat yourself.' },
    ],
  },
  {
    id: 'person',
    pick: 'My order arrived damaged',
    steps: [
      { kind: 'in', text: 'My order arrived damaged', time: '15:20' },
      { kind: 'log', icon: UserCheck, title: 'Handed to Asha, Support', detail: 'The chatbot steps aside and a person takes the chat.' },
      { kind: 'out', by: 'Asha, Support', text: 'I’m sorry about that. Could you tell me the order number?', time: '15:22' },
      { kind: 'in', text: 'It is 4471', time: '15:23' },
      { kind: 'log', icon: StickyNote, title: 'Private note added', detail: '“Replacement approved, ship today.” Only your team sees it.' },
      { kind: 'out', by: 'Asha, Support', text: 'A replacement ships today, at no charge.', time: '15:25' },
      { kind: 'log', icon: BarChart3, title: 'First reply: 2 minutes', detail: 'Reply times show up in your reports.' },
    ],
  },
  {
    id: 'night',
    pick: 'Are you open right now?',
    steps: [
      { kind: 'in', text: 'Are you open right now?', time: '23:40' },
      { kind: 'log', icon: Clock3, title: 'Nobody is at the desk', detail: 'The chatbot answers, even at 11:40 pm.' },
      { kind: 'out', by: 'Chatbot', text: 'We open at 10 am. What are you looking for? I’ll pass it on.', time: '23:40' },
      { kind: 'in', text: 'A gift hamper for 20 people', time: '23:41' },
      { kind: 'out', by: 'Chatbot', text: 'Noted. Someone will message you in the morning.', time: '23:41' },
      { kind: 'log', icon: UserCheck, title: 'Waiting in the shared inbox', detail: 'Your team opens the day with the request, ready to assign.' },
    ],
  },
  {
    id: 'offer',
    pick: 'SHOW me the festive offers',
    steps: [
      { kind: 'log', icon: Megaphone, title: 'Broadcast sent on schedule', detail: 'An approved template goes to everyone labelled “Repeat buyers”.' },
      { kind: 'out', by: 'Broadcast', text: 'Hi Neha, our festive collection is live. Reply SHOW to see this week’s offers.', time: '19:00' },
      { kind: 'in', text: 'SHOW me the festive offers', time: '19:04' },
      { kind: 'log', icon: Bot, title: 'Reply starts a chatbot flow', detail: 'The word SHOW triggers it, with no one typing.' },
      { kind: 'out', by: 'Chatbot', text: 'Here you go: sarees from ₹1,499 and kurtas from ₹899. Want one kept aside?', time: '19:04' },
      { kind: 'log', icon: BarChart3, title: 'Counted in campaign results', detail: 'Delivered and read receipts come in as they happen.' },
    ],
  },
];

const PAUSE = { in: 700, out: 1000, log: 600 };

export function MessageJourney() {
  const [storyId, setStoryId] = useState(STORIES[0].id);
  const story = STORIES.find((s) => s.id === storyId) ?? STORIES[0];
  const [shown, setShown] = useState(STORIES[0].steps.length);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const play = (next: Story) => {
    clear();
    setStoryId(next.id);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(next.steps.length);
      return;
    }
    setShown(1);
    let at = 0;
    next.steps.slice(1).forEach((step, i) => {
      at += PAUSE[step.kind];
      timers.current.push(window.setTimeout(() => setShown(i + 2), at));
    });
  };

  const steps = story.steps.map((step, i) => ({ step, on: i < shown, key: `${story.id}-${i}` }));
  const typing = shown < story.steps.length && story.steps[shown].kind === 'out';

  // Unplayed steps keep their space (invisible), so nothing on the page jumps.
  const reveal = (on: boolean) =>
    cn('transition-[opacity,translate] duration-300', on ? 'opacity-100' : 'invisible translate-y-2 opacity-0');

  return (
    <section id="journey" aria-labelledby="lp-journey-title" className="relative py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-x-14 gap-y-14 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[1fr_340px_1fr] lg:px-8">
        {/* What would you ask? */}
        <div className="md:col-span-2 lg:col-span-1">
          <RevealText
            id="lp-journey-title"
            text="Text us like a customer would"
            className="lp-section-title text-4xl text-[var(--lp-ink)] md:text-[3.25rem] md:leading-[1.08]"
          />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--lp-mute)]">
            Pick a message. The phone shows what your customer gets, and the list shows what Resend does for your team.
          </p>
          <div role="group" aria-label="Choose a message to send" className="mt-8 flex flex-wrap gap-2.5 lg:flex-col lg:items-start">
            {STORIES.map((s) => {
              const active = s.id === story.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => play(s)}
                  className={cn(
                    'min-h-11 rounded-2xl rounded-bl-sm border px-4 py-2.5 text-left text-[15px] font-medium transition-colors duration-200',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-[var(--lp-line)] bg-[var(--lp-raised)] text-[var(--lp-ink)] hover:border-primary',
                  )}
                >
                  {s.pick}
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer's phone */}
        <div className="mx-auto w-full max-w-[340px] rounded-[44px] bg-[#0f172a] p-2.5 shadow-[var(--lp-shadow-lg)] dark:bg-[#2a3349]">
          <div className="flex h-[520px] flex-col overflow-hidden rounded-[34px] bg-[#efeae2] dark:bg-[var(--lp-sunk)]">
            <div className="flex items-center gap-3 bg-[#075e54] px-5 pb-3.5 pt-5 text-white">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                YB
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Your business</p>
                <p className="text-xs text-white/85">{typing ? 'typing…' : 'online'}</p>
              </div>
            </div>
            <div
              role="log"
              aria-label="Customer’s WhatsApp chat"
              className="flex flex-1 flex-col gap-2.5 px-3.5 py-5"
            >
              {steps.map(({ step, on, key }) =>
                step.kind === 'log' ? null : (
                  <div
                    key={key}
                    className={cn(
                      'max-w-[86%] rounded-2xl px-3.5 py-2 text-sm leading-snug text-[var(--lp-ink)] shadow-[0_1px_1px_rgba(15,23,42,0.1)]',
                      step.kind === 'in'
                        ? 'self-end rounded-tr-sm bg-[var(--lp-bubble)]'
                        : 'self-start rounded-tl-sm bg-white dark:bg-[#2a3349]',
                      reveal(on),
                    )}
                  >
                    {step.by && (
                      <p className="mb-0.5 text-xs font-semibold text-[#6b4fc4] dark:text-[#c9c2ff]">{step.by}</p>
                    )}
                    <p>{step.text}</p>
                    <p className="mt-0.5 text-right text-[11px] text-[var(--lp-mute)]">{step.time}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* What Resend did */}
        <div className="min-h-[480px] md:min-h-[420px]">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--lp-ink)]">Meanwhile, in Resend</h3>
          <ol aria-live="polite" className="mt-7 space-y-8">
            {steps.map(({ step, on, key }) =>
              step.kind !== 'log' ? null : (
                <li key={key} className={cn('flex gap-4', reveal(on))}>
                  <step.icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} />
                  <div>
                    <p className="font-semibold text-[var(--lp-ink)]">{step.title}</p>
                    <p className="mt-1 leading-relaxed text-[var(--lp-mute)]">{step.detail}</p>
                  </div>
                </li>
              ),
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}
