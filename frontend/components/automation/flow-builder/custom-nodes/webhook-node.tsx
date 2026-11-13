'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Globe, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const WebhookNode = memo(({ data, selected }: NodeProps) => {
  const method = (data?.method as string) || 'POST';
  const url = (data?.url as string) || 'https://api.example.com/webhook';

  const getMethodBadgeClass = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET':
        return 'bg-info/10 text-info border-info/30';
      case 'POST':
        return 'bg-success/10 text-success border-success/30';
      case 'PUT':
      case 'PATCH':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'DELETE':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      className={`min-w-[260px] max-w-[320px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border hover:border-border/80'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background hover:!scale-125 transition-transform"
      />

      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10 border border-info/30 text-info shadow-2xs">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">Webhook call</span>
            <p className="text-xs text-muted-foreground">HTTP API request</p>
          </div>
        </div>

        <Badge variant="outline" className={`text-xs px-1.5 py-0 font-semibold ${getMethodBadgeClass(method)}`}>
          {method}
        </Badge>
      </div>

      <div className="pt-2">
        <p className="text-xs font-mono text-muted-foreground truncate bg-muted/30 p-1.5 rounded border border-border/40">
          {url}
        </p>

        {((data?.variables as any[])?.length ?? 0) > 0 && (
          <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
            <ArrowRight className="h-2.5 w-2.5 text-info" />
            <span>Maps {(data?.variables as any[]).length} response variable(s)</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
});

WebhookNode.displayName = 'WebhookNode';
