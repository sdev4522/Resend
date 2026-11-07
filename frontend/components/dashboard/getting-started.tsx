'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { contactsApi } from '@/lib/api/contacts';
import { cn } from '@/lib/utils';

/**
 * "Getting started" checklist on the dashboard home. Every item is derived from real
 * account data, so it ticks itself off as the workspace is set up. Hidden when complete
 * or when the user dismisses it (remembered per user in this browser only).
 */
interface GettingStartedProps {
  uid?: string;
  whatsappConnected: boolean;
  agentCount: number;
  activeChatbotCount: number;
}

export function GettingStarted({ uid, whatsappConnected, agentCount, activeChatbotCount }: GettingStartedProps) {
  const dismissKey = `resend_getting_started_dismissed_${uid || 'anon'}`;
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true); // assume hidden until storage is read (no flash)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  useEffect(() => {
    let alive = true;
    contactsApi
      .getPhonebooks()
      .then((res) => {
        if (!alive || !res?.success) return;
        const total = (res.data || []).reduce(
          (sum, pb) => sum + Number(pb.contactCount || 0),
          0,
        );
        setContactCount(total);
      })
      .catch(() => alive && setContactCount(0));
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    {
      done: whatsappConnected,
      title: 'Connect a WhatsApp number',
      detail: 'Scan a QR code or link the Cloud API.',
      href: '/dashboard/integrations?connect=qr',
      action: 'Connect',
    },
    {
      done: (contactCount ?? 0) > 0,
      title: 'Import your contacts',
      detail: 'Upload a CSV or add people one by one.',
      href: '/dashboard/contacts',
      action: 'Import',
    },
    {
      done: agentCount > 0,
      title: 'Invite a teammate',
      detail: 'Share the inbox and assign chats.',
      href: '/dashboard/team',
      action: 'Invite',
    },
    {
      done: activeChatbotCount > 0,
      title: 'Turn on an auto-reply',
      detail: 'Answer common questions automatically.',
      href: '/dashboard/automation',
      action: 'Set up',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || contactCount === null || doneCount === items.length) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, '1');
    } catch {
      // storage unavailable: hidden for this visit only
    }
  };

  return (
    <section aria-labelledby="gs-title" className="relative rounded-2xl border bg-card p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide getting started"
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3 pr-8">
        <div>
          <h2 id="gs-title" className="text-base font-semibold">
            Getting started
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {doneCount} of {items.length} done
          </p>
        </div>
        <div
          className="h-1.5 w-40 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={doneCount}
          aria-label="Setup progress"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneCount / items.length) * 100}%` }} />
        </div>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.title}
            className={cn('flex items-center gap-3 rounded-xl border p-3.5', item.done && 'bg-muted/40')}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
              aria-hidden="true"
            >
              {item.done && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm font-medium', item.done && 'text-muted-foreground line-through')}>
                <span className="sr-only">{item.done ? 'Done: ' : 'To do: '}</span>
                {item.title}
              </span>
              {!item.done && <span className="block text-xs text-muted-foreground">{item.detail}</span>}
            </span>
            {!item.done && (
              <Link
                href={item.href}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
              >
                {item.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
