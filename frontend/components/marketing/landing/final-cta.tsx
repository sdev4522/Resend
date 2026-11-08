'use client';

import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function FinalCta() {
  const { openRegister } = useAuthDialog();

  return (
    <section aria-labelledby="lp-final-title" className="px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/80 px-6 py-20 text-center shadow-[var(--lp-shadow-lg)] sm:px-12 lg:py-24 dark:border-white/10">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[var(--lp-raised)]">
          <div className="lp-glow -left-24 -top-24 h-[380px] w-[480px] bg-[var(--lp-glow-mint)]" />
          <div className="lp-glow -right-24 -bottom-24 h-[380px] w-[480px] bg-[var(--lp-glow-lilac)]" />
          <div className="lp-glow left-1/3 top-1/3 h-[260px] w-[360px] bg-[var(--lp-glow-peach)] opacity-60" />
        </div>
        <h2 id="lp-final-title" className="lp-display mx-auto max-w-3xl text-balance text-[clamp(2.25rem,5vw,3.75rem)] text-[var(--lp-ink)]">
          Your customers are already on WhatsApp. Meet them there.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--lp-mute)]">
          Scan a QR code or connect the Cloud API, invite your team, and send your first reply today.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={openRegister}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--lp-ink)] px-8 text-[15px] font-semibold text-[var(--lp-paper)] shadow-[0_10px_24px_-10px_rgba(15,23,42,0.6)] transition-transform hover:-translate-y-px"
          >
            Start free trial
          </button>
          <p className="text-sm text-[var(--lp-mute)]">14 days free. No card needed.</p>
        </div>
      </div>
    </section>
  );
}
