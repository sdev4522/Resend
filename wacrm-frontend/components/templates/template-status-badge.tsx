'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MetaTemplateStatus } from '@/types/template';
import { CheckCircle2, Clock, AlertTriangle, PauseCircle, XCircle } from 'lucide-react';

interface TemplateStatusBadgeProps {
  status: MetaTemplateStatus | string;
  className?: string;
}

export function TemplateStatusBadge({ status, className = '' }: TemplateStatusBadgeProps) {
  const normalized = (status || 'PENDING').toUpperCase() as MetaTemplateStatus;

  switch (normalized) {
    case 'APPROVED':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 gap-1 font-mono text-xs ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>APPROVED</span>
        </Badge>
      );

    case 'PENDING':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 gap-1 font-mono text-xs ${className}`}
        >
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>PENDING</span>
        </Badge>
      );

    case 'REJECTED':
      return (
        <Badge
          variant="destructive"
          className={`gap-1 font-mono text-xs ${className}`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>REJECTED</span>
        </Badge>
      );

    case 'PAUSED':
      return (
        <Badge
          variant="secondary"
          className={`gap-1 font-mono text-xs text-muted-foreground ${className}`}
        >
          <PauseCircle className="h-3 w-3" />
          <span>PAUSED</span>
        </Badge>
      );

    case 'DISABLED':
    default:
      return (
        <Badge
          variant="outline"
          className={`gap-1 font-mono text-xs text-muted-foreground ${className}`}
        >
          <XCircle className="h-3 w-3" />
          <span>{normalized}</span>
        </Badge>
      );
  }
}
