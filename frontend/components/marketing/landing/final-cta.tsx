'use client';

import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function FinalCta() {
  const { openRegister } = useAuthDialog();

  return (
    <section aria-labelledby="lp-final-title" className="lp-deep">
      <div className="mx-auto grid max-w-7xl items-end gap-10 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-32">
        <div className="lg:col-span-8">
          <h2 id="lp-final-title" className="lp-display text-[clamp(3rem,6.4vw,6rem)] text-[var(--lp-deep-ink)]">
            Your customers are already on WhatsApp. Meet them there.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--lp-deep-mute)]">
            Scan a QR code or connect the Cloud API, invite your team, and send your first reply today.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
          <button
            type="button"
            onClick={openRegister}
            className="inline-flex h-13 items-center justify-center rounded-full bg-primary px-9 text-base font-semibold text-primary-foreground transition-[filter] hover:brightness-110"
          >
            Start free trial
          </button>
          <p className="text-sm text-[var(--lp-deep-mute)]">14 days free. No card needed.</p>
        </div>
      </div>
    </section>
  );
}
