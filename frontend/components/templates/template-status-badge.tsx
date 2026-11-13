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
          className={`bg-success/10 text-success border-success/20 gap-1 font-mono text-xs ${className}`}
        >
          <CheckCircle2 className="h-3 w-3 text-success" />
          <span>APPROVED</span>
        </Badge>
      );

    case 'PENDING':
      return (
        <Badge
          variant="outline"
          className={`bg-warning/10 text-warning border-warning/20 gap-1 font-mono text-xs ${className}`}
        >
          <Clock className="h-3 w-3 text-warning" />
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
