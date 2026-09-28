'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const AiNode = memo(({ data, selected }: NodeProps) => {
  const instruction = (data?.instruction as string) || 'AI Assistant agent prompt...';
  const model = (data?.model as string) || 'gpt-4o';

  return (
    <div
      className={`min-w-[260px] max-w-[320px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-violet-500/40 hover:border-violet-500/70'
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-600 shadow-2xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">AI Response</span>
            <p className="text-[10px] text-muted-foreground">Conversational AI Agent</p>
          </div>
        </div>

        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
          {model}
        </Badge>
      </div>

      <div className="pt-2">
        <p className="text-[11px] text-foreground/80 line-clamp-2 leading-relaxed bg-muted/30 p-1.5 rounded border border-border/40 font-sans">
          {instruction}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
});

AiNode.displayName = 'AiNode';
