'use client';

import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function FinalCta() {
  const { openRegister } = useAuthDialog();

  return (
    <section aria-labelledby="lp-final-title" className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-[#0f231d] px-6 py-16 text-[#e9f1ed] sm:px-12 sm:py-20 lg:px-16">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 id="lp-final-title" className="lp-display text-[clamp(2.25rem,5vw,4rem)]">
              Your customers are already on WhatsApp. Meet them there.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#9db2aa]">
              Scan a QR code or connect the Cloud API, invite your team, and send your first reply today.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
            <button
              type="button"
              onClick={openRegister}
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[15px] font-semibold text-primary-foreground transition-[filter] hover:brightness-95"
            >
              Start free trial
            </button>
            <p className="text-sm text-[#9db2aa]">14 days free. No card needed.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
