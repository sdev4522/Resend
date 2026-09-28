'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const InitialNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-emerald-500/40 bg-emerald-500/5'
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-2xs">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">Trigger</span>
            <p className="text-[10px] text-muted-foreground">Flow Starting Point</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
          Start
        </Badge>
      </div>

      <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-emerald-600 shrink-0" />
        <span className="truncate">
          {(data?.sourceTitle as string) || 'Customer sends WhatsApp message'}
        </span>
      </div>

      {/* Outgoing port */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
});

InitialNode.displayName = 'InitialNode';
