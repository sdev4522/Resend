'use client';

import Link from 'next/link';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  title: string;
  description: string;
  /** "banner" sits above content; "limit" is a softer notice for quota limits. */
  tone?: 'locked' | 'limit';
  ctaLabel?: string;
  href?: string;
  className?: string;
}

/** One consistent look for every "your plan doesn't include this" moment. */
export function UpgradePrompt({
  title,
  description,
  tone = 'locked',
  ctaLabel = 'See plans',
  href = '/dashboard/billing',
  className,
}: UpgradePromptProps) {
  const Icon = tone === 'locked' ? Lock : Sparkles;
  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:gap-5',
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1',
        tone === 'locked' ? 'before:bg-primary' : 'before:bg-warning',
        className
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'locked' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button render={<Link href={href} />} className="shrink-0 self-start sm:self-auto">
        {ctaLabel}
        <ArrowRight />
      </Button>
    </div>
  );
}
