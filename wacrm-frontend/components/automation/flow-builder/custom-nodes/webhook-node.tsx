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
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'DELETE':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 shadow-2xs">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">Webhook Call</span>
            <p className="text-[10px] text-muted-foreground">HTTP API Request</p>
          </div>
        </div>

        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-bold ${getMethodBadgeClass(method)}`}>
          {method}
        </Badge>
      </div>

      <div className="pt-2">
        <p className="text-[11px] font-mono text-muted-foreground truncate bg-muted/30 p-1.5 rounded border border-border/40">
          {url}
        </p>

        {((data?.variables as any[])?.length ?? 0) > 0 && (
          <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
            <ArrowRight className="h-2.5 w-2.5 text-cyan-500" />
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
