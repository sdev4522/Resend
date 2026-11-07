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
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-[background-color,border-color] duration-300',
        scrolled
          ? 'border-b border-[var(--lp-line)] bg-[color-mix(in_oklab,var(--lp-paper)_86%,transparent)] backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8"
      >
        <Link href="/" className="flex items-center gap-2 text-[var(--lp-ink)]">
          <ResendMark className="h-8 w-8 text-primary" />
          <span className="lp-section-title text-xl">Resend</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3.5 py-2 text-sm text-[var(--lp-mute)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--lp-ink)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link
              href={dashboardHref}
              className="inline-flex h-10 items-center rounded-full bg-[var(--lp-ink)] px-5 text-sm font-medium text-[var(--lp-paper)] transition-opacity hover:opacity-90"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={openLogin}
                className="hidden h-10 rounded-full px-4 text-sm font-medium text-[var(--lp-ink)] hover:bg-[var(--muted)] sm:inline-flex sm:items-center"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={openRegister}
                className="hidden h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-95 sm:inline-flex"
              >
                Start free trial
              </button>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--lp-ink)] hover:bg-[var(--muted)] md:hidden"
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
        <div
          id="lp-mobile-menu"
          className="border-t border-[var(--lp-line)] bg-[var(--lp-paper)] px-4 pb-6 pt-2 md:hidden"
        >
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base text-[var(--lp-ink)]"
                >
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
                className="h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                Start free trial
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
