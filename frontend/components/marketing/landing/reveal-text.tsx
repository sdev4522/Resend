'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Heading whose words rise into place once it scrolls into view.
 * Rendered fully visible on the server; GSAP only animates when motion is allowed.
 */
export function RevealText({
  text,
  as = 'h2',
  id,
  className,
}: {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('.lp-rw', {
        yPercent: 110,
        opacity: 0,
        duration: 0.8,
        ease: 'power4.out',
        stagger: 0.05,
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  const words = text.split(' ');
  // The allowed tags all take the same ref/props shape here
  const Tag = as as 'h2';
  return (
    <Tag ref={ref} id={id} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className="lp-rw inline-block">
            {w}
            {i < words.length - 1 ? '\u00a0' : ''}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/** Number that counts up from 0 the first time it is seen. */
export function CountUp({ to, suffix = '', className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const state = { v: 0 };
    let tween: gsap.core.Tween | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        tween = gsap.to(state, {
          v: to,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: () => setValue(Math.round(state.v)),
        });
      },
      { threshold: 0.4 },
    );
    setValue(0);
    io.observe(el);
    return () => {
      io.disconnect();
      tween?.kill();
    };
  }, [to]);

  return (
    <span ref={ref} className={className} aria-label={`${to.toLocaleString('en-IN')}${suffix}`}>
      <span aria-hidden="true">
        {value.toLocaleString('en-IN')}
        {suffix}
      </span>
    </span>
  );
}

/** onMouseMove handler for `.lp-spot` cards: moves the spotlight to the pointer. */
export function trackSpot(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}
