'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { RotateCcw } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

/* ---------------------------------------------------------------------------
 * Hero: one WhatsApp conversation becoming CRM work, played once on load.
 * Server-rendered in its finished state (works without JS / reduced motion);
 * GSAP hides the steps and replays them in order. "Replay" re-runs it.
 * ------------------------------------------------------------------------- */

function Ticks({ read = false }: { read?: boolean }) {
  return (
    <svg
      viewBox="0 0 18 11"
      aria-label={read ? 'Read' : 'Delivered'}
      className="lp-ticks ml-1 inline-block h-[11px] w-[18px] align-[-1px]"
      data-read={read ? 'true' : 'false'}
    >
      <path d="M1 6l3.2 3L11 2" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" />
      <path d="M6.5 8.6L7.2 9 14 2" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function Incoming({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="lp-step flex justify-start">
      <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-[var(--lp-raised)] px-3.5 py-2 text-[13.5px] leading-snug text-[var(--lp-ink)] shadow-[0_1px_0_var(--lp-line)]">
        {children}
        <span className="ml-2 align-bottom text-[10.5px] text-[var(--lp-mute)]">{time}</span>
      </div>
    </div>
  );
}

function Outgoing({
  children,
  time,
  by,
  ticksRef,
}: {
  children: React.ReactNode;
  time: string;
  by: string;
  ticksRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="lp-step flex flex-col items-end">
      <span className="mb-1 mr-1 text-[11px] text-[var(--lp-mute)]">{by}</span>
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--lp-bubble)] px-3.5 py-2 text-[13.5px] leading-snug text-[var(--lp-ink)]">
        {children}
        <span ref={ticksRef} className="ml-2 inline-flex items-center align-bottom text-[10.5px] text-[var(--lp-mute)]">
          {time}
          <Ticks read />
        </span>
      </div>
    </div>
  );
}

const stages = ['New lead', 'Qualified', 'Paid'];

export function HeroDesk() {
  const { openRegister } = useAuthDialog();
  const root = useRef<HTMLElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const lastTicks = useRef<HTMLSpanElement>(null);

  const build = useCallback(() => {
    const q = gsap.utils.selector(root);
    const t = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.45 } });

    // Initial state
    t.set(q('.lp-step, .lp-side-item, .lp-typing'), { autoAlpha: 0, y: 10 });
    t.set(q('.lp-stage-dot'), { backgroundColor: 'var(--lp-line)' });
    t.set(q('.lp-stage-label'), { color: 'var(--lp-mute)' });
    t.set(q('.lp-ticks[data-read="true"]'), { color: 'var(--lp-mute)' });
    t.set(q('.lp-headline-line'), { yPercent: 105 });
    t.set(q('.lp-hero-copy'), { autoAlpha: 0, y: 12 });

    // Headline + copy
    t.to(q('.lp-headline-line'), { yPercent: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' })
      .to(q('.lp-hero-copy'), { autoAlpha: 1, y: 0, stagger: 0.08 }, '-=0.45');

    const steps = q('.lp-step');
    const side = q('.lp-side-item');
    const typing = q('.lp-typing');
    const dots = q('.lp-stage-dot');
    const labels = q('.lp-stage-label');

    const activate = (i: number) =>
      t
        .to(dots[i], { backgroundColor: 'var(--primary)', duration: 0.3 })
        .to(labels[i], { color: 'var(--lp-ink)', duration: 0.3 }, '<');

    // 1. Customer asks
    t.to(steps[0], { autoAlpha: 1, y: 0 }, '+=0.2');
    activate(0);
    t.to(side[0], { autoAlpha: 1, y: 0 }, '<');
    // 2. Bot types and answers instantly
    t.to(typing[0], { autoAlpha: 1, y: 0, height: 'auto', duration: 0.25 }, '+=0.25')
      .to(typing[0], { autoAlpha: 0, height: 0, duration: 0.2 }, '+=0.7')
      .to(steps[1], { autoAlpha: 1, y: 0 })
      .to(q('.lp-step .lp-ticks')[0], { color: 'var(--lp-read)', duration: 0.3 }, '+=0.4');
    // 3. Label is added automatically
    t.to(side[1], { autoAlpha: 1, y: 0 }, '-=0.1');
    // 4. Customer wants to pay -> lead qualified, agent assigned
    t.to(steps[2], { autoAlpha: 1, y: 0 }, '+=0.5');
    activate(1);
    t.to(side[2], { autoAlpha: 1, y: 0 }, '<');
    // 5. Agent sends payment link, read
    t.to(steps[3], { autoAlpha: 1, y: 0 }, '+=0.6')
      .to(q('.lp-step .lp-ticks')[1], { color: 'var(--lp-read)', duration: 0.3 }, '+=0.5');
    // 6. Paid
    t.to(steps[4], { autoAlpha: 1, y: 0 }, '+=0.6');
    activate(2);
    t.to(side[3], { autoAlpha: 1, y: 0 }, '<');

    return t;
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      tl.current = build();
    }, root);
    return () => ctx.revert();
  }, [build]);

  const replay = () => {
    if (!tl.current) return;
    tl.current.restart();
  };

  return (
    <section ref={root} aria-labelledby="lp-hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-28">
        {/* Copy */}
        <div className="flex flex-col justify-center lg:col-span-6">
          <h1 id="lp-hero-title" className="lp-display text-[clamp(2.6rem,4.9vw,4.4rem)] text-[var(--lp-ink)]">
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="lp-headline-line block">Turn every</span>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="lp-headline-line block">WhatsApp chat</span>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <span className="lp-headline-line block">into a sale.</span>
            </span>
          </h1>

          <p className="lp-hero-copy mt-7 max-w-[34rem] text-lg leading-relaxed text-[var(--lp-mute)]">
            One shared inbox for your team, chatbots that reply at 2 a.m., and broadcasts that reach every
            customer. Connect your number in minutes with a QR scan or the official Cloud API.
          </p>

          <div className="lp-hero-copy mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openRegister}
              className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_24px_-12px_var(--primary)] transition-[filter,transform] hover:brightness-95 active:translate-y-px"
            >
              Start free trial
            </button>
            <a
              href="#pricing"
              className="inline-flex h-12 items-center rounded-full border border-[var(--lp-line)] px-6 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[var(--muted)]"
            >
              See pricing
            </a>
          </div>
          <p className="lp-hero-copy mt-4 text-sm text-[var(--lp-mute)]">14 days free. No card needed.</p>
        </div>

        {/* The desk */}
        <div className="lg:col-span-6">
          <div className="relative rounded-[28px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-2 shadow-[0_40px_80px_-48px_rgba(15,35,29,0.45)]">
            <div className="grid overflow-hidden rounded-[22px] border border-[var(--lp-line)] sm:grid-cols-[1fr_200px]">
              {/* Conversation */}
              <div className="flex min-h-[440px] flex-col bg-[color-mix(in_oklab,var(--lp-paper)_70%,var(--lp-bubble))]">
                <div className="flex items-center gap-3 border-b border-[var(--lp-line)] bg-[var(--lp-raised)] px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2c94c] text-sm font-semibold text-[#3d2f00]">
                    PS
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-[var(--lp-ink)]">Priya Sharma</p>
                    <p className="text-xs text-[var(--lp-mute)]">+91 98201 4xxxx, via WhatsApp</p>
                  </div>
                  <button
                    type="button"
                    onClick={replay}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--lp-mute)] hover:bg-[var(--muted)] hover:text-[var(--lp-ink)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Replay
                  </button>
                </div>

                <div role="log" aria-label="Example conversation" className="flex flex-1 flex-col justify-end gap-2.5 px-4 py-5">
                  <Incoming time="10:42">Hi! Is the indigo kurta available in size M?</Incoming>

                  <div className="lp-typing invisible flex h-0 justify-end opacity-0" aria-hidden="true">
                    <div className="flex gap-1 rounded-2xl rounded-tr-sm bg-[var(--lp-bubble)] px-3.5 py-3">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lp-mute)]" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>

                  <Outgoing by="Auto-reply" time="10:42">
                    Yes, M is in stock. ₹1,299 with free delivery in Pune. Shall I keep one for you?
                  </Outgoing>
                  <Incoming time="10:44">Yes please. Can I pay online?</Incoming>
                  <Outgoing by="Rohan, Sales" time="10:45" ticksRef={lastTicks}>
                    Of course. Here is your secure payment link: pay.example/k/8XQ2
                  </Outgoing>
                  <Incoming time="10:47">Done, paid!</Incoming>
                </div>
              </div>

              {/* CRM side panel */}
              <aside aria-label="Customer record" className="hidden border-l border-[var(--lp-line)] bg-[var(--lp-raised)] p-4 sm:block">
                <p className="text-xs text-[var(--lp-mute)]">Customer</p>
                <p className="lp-side-item mt-1 text-sm font-semibold text-[var(--lp-ink)]">Priya Sharma</p>

                <p className="mt-5 text-xs text-[var(--lp-mute)]">Labels</p>
                <div className="lp-side-item mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--lp-ink)]">
                    Kurta enquiry
                  </span>
                </div>

                <p className="mt-5 text-xs text-[var(--lp-mute)]">Assigned to</p>
                <p className="lp-side-item mt-1 text-sm text-[var(--lp-ink)]">Rohan, Sales</p>

                <p className="mt-5 text-xs text-[var(--lp-mute)]">Deal stage</p>
                <ol className="mt-2 space-y-2.5">
                  {stages.map((s) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span className="lp-stage-dot h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="lp-stage-label text-sm text-[var(--lp-ink)]">{s}</span>
                    </li>
                  ))}
                </ol>

                <div className="lp-side-item mt-6 rounded-xl bg-[var(--lp-bubble)] p-3">
                  <p className="text-xs text-[var(--lp-mute)]">Payment received</p>
                  <p className="lp-section-title mt-0.5 text-xl text-[var(--lp-ink)]">₹1,299</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
