'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const DelayNode = memo(({ data, selected }: NodeProps) => {
  const seconds = Number(data?.seconds) || 5;

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec} second${sec !== 1 ? 's' : ''}`;
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (remainingSec === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return `${mins}m ${remainingSec}s`;
  };

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-600 shadow-2xs">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">Delay</span>
            <p className="text-[10px] text-muted-foreground">Pause execution</p>
          </div>
        </div>

        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
          Timer
        </Badge>
      </div>

      <div className="pt-2 text-center">
        <div className="text-xs font-mono font-bold text-foreground bg-muted/30 py-1 px-2 rounded border border-border/40">
          ⏳ Wait {formatDuration(seconds)}
        </div>
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

DelayNode.displayName = 'DelayNode';
