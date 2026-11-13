'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const InitialNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-xl border bg-card p-3 shadow-sm transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-success/40 bg-success/5'
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-success/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success text-white shadow-2xs">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">Trigger</span>
            <p className="text-xs text-muted-foreground">Flow starting point</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs px-1.5 py-0">
          Start
        </Badge>
      </div>

      <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3 text-success shrink-0" />
        <span className="truncate">
          {(data?.sourceTitle as string) || 'Customer sends WhatsApp message'}
        </span>
      </div>

      {/* Outgoing port */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-3 !h-3 !bg-success !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
});

InitialNode.displayName = 'InitialNode';
