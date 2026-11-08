'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { cn } from '@/lib/utils';

const links = [
  { href: '#journey', label: 'Product' },
  { href: '#how-it-works', label: 'Setup' },
  { href: '#comparison', label: 'Compare' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function ResendMark({ className }: { className?: string }) {
  // Chat bubble with a forward tick: "message sent" — the brand in one glyph
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path
        d="M16 3C8.8 3 3 8.4 3 15.1c0 2.5.8 4.8 2.2 6.7L4 28l6.6-1.8c1.6.6 3.5 1 5.4 1 7.2 0 13-5.4 13-12.1S23.2 3 16 3Z"
        fill="currentColor"
      />
      <path
        d="m10.5 15.6 3.6 3.5 7.4-7.3"
        fill="none"
        stroke="var(--lp-paper, #fff)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingNav() {
  const { isAuthenticated, user } = useAuth();
  const { openLogin, openRegister } = useAuthDialog();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dashboardHref = user?.role === 'admin' ? '/admin' : '/dashboard';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-6">
      <div
        className={cn(
          'mx-auto max-w-6xl rounded-full border transition-[background-color,box-shadow,border-color] duration-300',
          scrolled || open
            ? 'border-white/80 bg-white/80 shadow-[var(--lp-shadow)] backdrop-blur-xl dark:border-white/10 dark:bg-[var(--lp-raised)]/80'
            : 'border-transparent bg-transparent',
          open && 'rounded-3xl',
        )}
      >
        <nav aria-label="Main" className="flex h-14 items-center justify-between gap-4 pl-4 pr-2 sm:pl-5">
          <Link href="/" className="flex items-center gap-2 text-[var(--lp-ink)]">
            <ResendMark className="h-7 w-7 text-primary" />
            <span className="lp-section-title text-lg">Resend</span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-[var(--lp-mute)] transition-colors hover:bg-[var(--lp-sunk)] hover:text-[var(--lp-ink)]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                href={dashboardHref}
                className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-[var(--lp-ink)] px-4 text-sm font-medium text-[var(--lp-paper)] transition-opacity hover:opacity-90 sm:px-5"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openLogin}
                  className="hidden h-10 rounded-full px-4 text-sm font-medium text-[var(--lp-ink)] hover:bg-[var(--lp-sunk)] sm:inline-flex sm:items-center"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={openRegister}
                  className="hidden h-10 items-center rounded-full bg-[var(--lp-ink)] px-5 text-sm font-semibold text-[var(--lp-paper)] transition-opacity hover:opacity-90 sm:inline-flex"
                >
                  Start free trial
                </button>
              </>
            )}
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--lp-ink)] hover:bg-[var(--lp-sunk)] md:hidden"
              aria-expanded={open}
              aria-controls="lp-mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {open && (
          <div id="lp-mobile-menu" className="border-t border-[var(--lp-line)] px-5 pb-5 pt-2 md:hidden">
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-base text-[var(--lp-ink)]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            {!isAuthenticated && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openLogin();
                  }}
                  className="h-11 rounded-full border border-[var(--lp-line)] text-sm font-medium"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openRegister();
                  }}
                  className="h-11 rounded-full bg-[var(--lp-ink)] text-sm font-semibold text-[var(--lp-paper)]"
                >
                  Start free trial
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
