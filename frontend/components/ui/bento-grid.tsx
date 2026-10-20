'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid w-full auto-rows-[22rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface BentoCardProps {
  name: string;
  className?: string;
  background?: React.ReactNode;
  Icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  description: string;
  href?: string;
  cta?: string;
  badge?: string;
  onClick?: () => void;
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  badge,
  onClick,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-xs transition-all duration-300 hover:border-foreground/20 hover:shadow-md dark:border-border/60 dark:hover:border-border',
        className
      )}
    >
      {/* Background preview container */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-90 transition-opacity duration-300 group-hover:opacity-100">
        {background}
      </div>

      {/* Top Header */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-foreground shadow-xs backdrop-blur-xs transition-transform duration-300 group-hover:scale-105">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        {badge && (
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary text-[11px] font-medium"
          >
            {badge}
          </Badge>
        )}
      </div>

      {/* Bottom Content / Info */}
      <div className="relative z-10 mt-auto flex flex-col gap-2 rounded-xl bg-card/85 p-3 backdrop-blur-xs transition-colors duration-300 dark:bg-card/90">
        <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {name}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {description}
        </p>

        {(cta || href || onClick) && (
          <div className="pt-1">
            {href ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 -ml-2 px-2 text-xs font-semibold text-primary hover:text-primary/90"
                render={<Link href={href} />}
              >
                {cta || 'Learn more'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : onClick ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClick}
                className="h-8 -ml-2 px-2 text-xs font-semibold text-primary hover:text-primary/90"
              >
                {cta || 'Learn more'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
