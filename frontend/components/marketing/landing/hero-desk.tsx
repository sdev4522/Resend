'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BarChart3, Bot, Clock3, Inbox, Megaphone, RotateCcw, Users } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { CountUp } from './reveal-text';

/* ---------------------------------------------------------------------------
 * Hero: centred headline over soft gradient light, then a product window where
 * one WhatsApp conversation becomes a sale (played once on load, ends on a
 * "Paid" stamp). Server-rendered in its finished state for no-JS / reduced motion.
 * ------------------------------------------------------------------------- */

function Ticks({ read = false }: { read?: boolean }) {
  return (
    <svg
      viewBox="0 0 18 11"
      aria-label={read ? 'Read' : 'Delivered'}
      className="lp-ticks ml-1 inline-block h-[11px] w-[18px] align-[-1px] text-[var(--lp-read)]"
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
      <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-[var(--lp-raised)] px-3.5 py-2 text-[14px] leading-snug text-[var(--lp-ink)] shadow-[0_1px_1px_rgba(15,23,42,0.1)]">
        {children}
        <span className="ml-2 align-bottom text-[10.5px] text-[var(--lp-mute)]">{time}</span>
      </div>
    </div>
  );
}

function Outgoing({ children, time, by }: { children: React.ReactNode; time: string; by: string }) {
  return (
    <div className="lp-step flex flex-col items-end">
      <span className="mb-1 mr-1 text-[11px] font-medium text-[var(--lp-mute)]">{by}</span>
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--lp-bubble)] px-3.5 py-2 text-[14px] leading-snug text-[var(--lp-ink)] shadow-[0_1px_1px_rgba(15,23,42,0.1)]">
        {children}
        <span className="ml-2 inline-flex items-center align-bottom text-[10.5px] text-[var(--lp-mute)]">
          {time}
          <Ticks read />
        </span>
      </div>
    </div>
  );
}

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`lp-fc absolute z-10 hidden rounded-2xl border border-white/70 bg-white/85 p-3.5 shadow-[var(--lp-shadow)] backdrop-blur-md lg:block dark:border-white/10 dark:bg-[var(--lp-raised)]/85 ${className}`}
    >
      {children}
    </div>
  );
}

const stages = ['New lead', 'Qualified', 'Paid'];
const rail = [Inbox, Bot, Megaphone, BarChart3, Users];
const agents = [
  { i: 'RS', c: '#7c6cf2' },
  { i: 'AK', c: '#f2a93b' },
  { i: 'NM', c: '#2fa6de' },
];

export function HeroDesk() {
  const { openRegister } = useAuthDialog();
  const root = useRef<HTMLElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  const build = useCallback(() => {
    const q = gsap.utils.selector(root);
    const t = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.45 } });

    t.set(q('.lp-step, .lp-side-item, .lp-typing'), { autoAlpha: 0, y: 10 });
    t.set(q('.lp-stage-dot'), { backgroundColor: 'var(--lp-line)' });
    t.set(q('.lp-stage-label'), { color: 'var(--lp-mute)' });
    t.set(q('.lp-ticks[data-read="true"]'), { color: 'var(--lp-mute)' });
    t.set(q('.lp-hero-copy'), { autoAlpha: 0, y: 16 });
    t.set(q('.lp-hw'), { yPercent: 115, rotate: 4 });
    t.set(q('.lp-underline'), { strokeDashoffset: 1 });
    t.set(q('.lp-window'), { autoAlpha: 0, y: 40 });
    t.set(q('.lp-fc'), { autoAlpha: 0 });
    t.set(q('.lp-stamp'), { autoAlpha: 0, scale: 1.9, rotate: -24 });

    t.to(q('.lp-hero-copy')[0], { autoAlpha: 1, y: 0, duration: 0.5 })
      .to(q('.lp-hw'), { yPercent: 0, rotate: 0, duration: 0.9, ease: 'power4.out', stagger: 0.07 }, '-=0.2')
      .to(q('.lp-underline'), { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, '-=0.35')
      .to(q('.lp-hero-copy').slice(1), { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.6 }, '-=0.5')
      .to(q('.lp-window'), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power4.out' }, '-=0.3')
      .to(q('.lp-fc'), { autoAlpha: 1, duration: 0.5, stagger: 0.15 }, '-=0.4');

    const steps = q('.lp-step');
    const side = q('.lp-side-item');
    const typing = q('.lp-typing');
    const dots = q('.lp-stage-dot');
    const labels = q('.lp-stage-label');
    const ticks = q('.lp-step .lp-ticks');

    const activate = (i: number, color = 'var(--primary)') =>
      t.to(dots[i], { backgroundColor: color, duration: 0.3 }).to(labels[i], { color: 'var(--lp-ink)', duration: 0.3 }, '<');

    t.to(steps[0], { autoAlpha: 1, y: 0 }, '+=0.1');
    activate(0);
    t.to(side[0], { autoAlpha: 1, y: 0 }, '<');
    t.to(typing[0], { autoAlpha: 1, y: 0, height: 'auto', duration: 0.25 }, '+=0.25')
      .to(typing[0], { autoAlpha: 0, height: 0, duration: 0.2 }, '+=0.7')
      .to(steps[1], { autoAlpha: 1, y: 0 })
      .to(ticks[0], { color: 'var(--lp-read)', duration: 0.3 }, '+=0.4');
    t.to(side[1], { autoAlpha: 1, y: 0 }, '-=0.1');
    t.to(steps[2], { autoAlpha: 1, y: 0 }, '+=0.5');
    activate(1);
    t.to(side[2], { autoAlpha: 1, y: 0 }, '<');
    t.to(steps[3], { autoAlpha: 1, y: 0 }, '+=0.6').to(ticks[1], { color: 'var(--lp-read)', duration: 0.3 }, '+=0.5');
    t.to(steps[4], { autoAlpha: 1, y: 0 }, '+=0.6');
    activate(2, 'var(--lp-money)');
    t.to(q('.lp-stamp'), { autoAlpha: 1, scale: 1, rotate: -9, duration: 0.55, ease: 'back.out(2.4)' }, '+=0.25');
    t.to(side[3], { autoAlpha: 1, y: 0 }, '-=0.1');

    return t;
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      tl.current = build();
    }, root);
    return () => ctx.revert();
  }, [build]);

  const replay = () => tl.current?.restart();

  return (
    <section ref={root} aria-labelledby="lp-hero-title" className="relative isolate -mt-[68px] overflow-hidden pt-[68px]">
      {/* Gradient light */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="lp-glow left-[-10%] top-[-8%] h-[520px] w-[620px] bg-[var(--lp-glow-mint)]" />
        <div className="lp-glow right-[-12%] top-[4%] h-[560px] w-[640px] bg-[var(--lp-glow-lilac)]" />
        <div className="lp-glow left-[30%] top-[38%] h-[420px] w-[520px] bg-[var(--lp-glow-sky)] opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-[var(--lp-paper)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 md:pt-20 lg:px-8">
        {/* Copy */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="lp-hero-copy inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[var(--lp-ink)] shadow-[var(--lp-shadow)] backdrop-blur dark:border-white/10 dark:bg-white/5">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            QR scan or official Cloud API, in one inbox
          </p>
          <h1
            id="lp-hero-title"
            aria-label="Get WhatsApp Business API in 5 minutes"
            className="lp-display mt-6 text-[clamp(2.6rem,6.4vw,5rem)] text-[var(--lp-ink)]"
          >
            <span aria-hidden="true" className="block">
              {['Get', 'WhatsApp', 'Business', 'API'].map((w) => (
                <span key={w} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                  <span className="lp-hw inline-block origin-bottom-left">{w}&nbsp;</span>
                </span>
              ))}
            </span>
            <span aria-hidden="true" className="block">
              <span className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                <span className="lp-hw inline-block origin-bottom-left">in&nbsp;</span>
              </span>
              <span className="relative inline-block">
                <span className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                  <span className="lp-hw inline-block origin-bottom-left bg-gradient-to-r from-primary via-[#14b8a6] to-[#6d5cf0] bg-clip-text text-transparent">
                    5 minutes
                  </span>
                </span>
                <svg
                  viewBox="0 0 300 16"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute -bottom-1 left-0 h-[0.28em] w-full"
                >
                  <path
                    className="lp-underline"
                    d="M3 11 C 70 3, 170 2, 297 9"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="1"
                  />
                </svg>
              </span>
            </span>
          </h1>
          <p className="lp-hero-copy mx-auto mt-7 max-w-[38rem] text-lg leading-relaxed text-[var(--lp-mute)]">
            Then turn every chat into a sale: one shared inbox for your team, chatbots that reply at 2 a.m., and
            broadcasts that reach every customer.
          </p>
          <div className="lp-hero-copy mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openRegister}
              className="lp-shine inline-flex h-12 items-center rounded-full bg-[var(--lp-ink)] px-7 text-[15px] font-semibold text-[var(--lp-paper)] shadow-[0_10px_24px_-10px_rgba(15,23,42,0.6)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(0,168,132,0.7)] active:translate-y-0"
            >
              Start free trial
            </button>
            <a
              href="#pricing"
              className="inline-flex h-12 items-center rounded-full border border-[var(--lp-line)] bg-white/70 px-6 text-[15px] font-medium text-[var(--lp-ink)] backdrop-blur transition-[background-color,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--lp-ink)]/25 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
            >
              See pricing
            </a>
          </div>
          <p className="lp-hero-copy mt-4 text-sm text-[var(--lp-mute)]">Free trial. No card needed.</p>
        </div>

        {/* Product window with floating cards */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <FloatCard className="lp-float -left-24 -top-14 w-48">
            <div className="flex items-center gap-2 text-xs text-[var(--lp-mute)]">
              <Clock3 className="h-3.5 w-3.5" /> Median first reply
            </div>
            <p className="lp-section-title mt-1 text-2xl text-[var(--lp-ink)]">2 min</p>
          </FloatCard>

          <FloatCard className="lp-float-slow -bottom-9 -left-16 w-56">
            <p className="text-xs text-[var(--lp-mute)]">Agents online</p>
            <div className="mt-2 flex items-center">
              {agents.map((a, i) => (
                <span
                  key={a.i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white"
                  style={{ backgroundColor: a.c, marginLeft: i ? -8 : 0 }}
                >
                  {a.i}
                </span>
              ))}
              <span className="ml-2 text-sm font-medium text-[var(--lp-ink)]">3 replying</span>
            </div>
          </FloatCard>

          <FloatCard className="lp-float -bottom-11 -right-14 w-60">
            <div className="flex items-center justify-between text-xs text-[var(--lp-mute)]">
              <span className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5" /> Festive broadcast
              </span>
              <CountUp to={96} suffix="%" />
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--lp-sunk)]">
              <div className="h-1.5 w-[96%] rounded-full bg-primary" />
            </div>
            <p className="mt-1.5 text-xs text-[var(--lp-mute)]">delivered to <CountUp to={4812} /> customers</p>
          </FloatCard>

          <div className="lp-window relative rounded-[28px] border border-white/80 bg-white/55 p-2 shadow-[var(--lp-shadow-lg)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <div className="overflow-hidden rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-raised)]">
              {/* Window bar */}
              <div className="flex items-center gap-2 border-b border-[var(--lp-line)] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs font-medium text-[var(--lp-mute)]">Team inbox</span>
              </div>

              <div className="grid sm:grid-cols-[52px_1fr_210px]">
                {/* App rail */}
                <nav aria-hidden="true" className="hidden flex-col items-center gap-2 border-r border-[var(--lp-line)] bg-[var(--lp-sunk)] py-4 sm:flex">
                  {rail.map((Icon, i) => (
                    <span
                      key={i}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${i === 0 ? 'bg-primary text-primary-foreground' : 'text-[var(--lp-mute)]'}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </nav>

                {/* Conversation */}
                <div className="relative flex min-h-[470px] flex-col bg-[#f0f4f1] dark:bg-[var(--lp-sunk)]">
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
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--lp-mute)] hover:bg-[var(--lp-sunk)] hover:text-[var(--lp-ink)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Replay
                    </button>
                  </div>

                  <div role="log" aria-label="Example conversation" className="flex flex-1 flex-col justify-end gap-2.5 px-4 pb-20 pt-5">
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
                    <Outgoing by="Rohan, Sales" time="10:45">
                      Of course. Here is your secure payment link: pay.example/k/8XQ2
                    </Outgoing>
                    <Incoming time="10:47">Done, paid!</Incoming>
                  </div>

                  <div
                    className="lp-stamp pointer-events-none absolute bottom-3 right-6 -rotate-[9deg] rounded-2xl bg-[var(--lp-money)] p-1.5 shadow-[0_18px_30px_-12px_rgba(58,37,0,0.55)]"
                    aria-label="Payment received: ₹1,299"
                    role="img"
                  >
                    <div className="rounded-xl border-2 border-dashed border-[var(--lp-money-ink)]/45 px-4 py-2 text-center text-[var(--lp-money-ink)]">
                      <p className="lp-display text-[2.1rem] leading-none">Paid</p>
                      <p className="lp-section-title mt-0.5 text-lg">₹1,299</p>
                    </div>
                  </div>
                </div>

                {/* CRM side panel */}
                <aside aria-label="Customer record" className="hidden border-l border-[var(--lp-line)] bg-[var(--lp-raised)] p-4 sm:block">
                  <p className="text-xs text-[var(--lp-mute)]">Customer</p>
                  <p className="lp-side-item mt-1 text-sm font-semibold text-[var(--lp-ink)]">Priya Sharma</p>

                  <p className="mt-5 text-xs text-[var(--lp-mute)]">Labels</p>
                  <div className="lp-side-item mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#ece9ff] px-2.5 py-1 text-xs font-medium text-[#4b3fb8] dark:bg-[#2a2550] dark:text-[#c9c2ff]">
                      Kurta enquiry
                    </span>
                  </div>

                  <p className="mt-5 text-xs text-[var(--lp-mute)]">Assigned to</p>
                  <p className="lp-side-item mt-1 text-sm text-[var(--lp-ink)]">Rohan, Sales</p>

                  <p className="mt-5 text-xs text-[var(--lp-mute)]">Deal stage</p>
                  <ol className="mt-2 space-y-2.5">
                    {stages.map((s, i) => (
                      <li key={s} className="flex items-center gap-2.5">
                        <span
                          className="lp-stage-dot h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: i === stages.length - 1 ? 'var(--lp-money)' : 'var(--primary)' }}
                        />
                        <span className="lp-stage-label text-sm text-[var(--lp-ink)]">{s}</span>
                      </li>
                    ))}
                  </ol>

                  <p className="lp-side-item mt-6 border-t border-[var(--lp-line)] pt-4 text-xs leading-relaxed text-[var(--lp-mute)]">
                    Answered in 4 seconds. Closed in 5 minutes.
                  </p>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
