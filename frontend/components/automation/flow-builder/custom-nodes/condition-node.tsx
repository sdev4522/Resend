'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { ConditionRule } from '@/types/automation';

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const conditions = ((data?.conditions as ConditionRule[]) || []);

  return (
    <div
      className={`min-w-[280px] max-w-[340px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-amber-500/40 bg-card hover:border-amber-500/60'
      }`}
    >
      {/* Incoming port */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background hover:!scale-125 transition-transform"
      />

      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 shadow-2xs">
            <GitFork className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">Condition Router</span>
            <p className="text-[10px] text-muted-foreground">Branch by matching keywords</p>
          </div>
        </div>
      </div>

      {/* Rules list with individual handle ports */}
      <div className="pt-2 space-y-2">
        {conditions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic p-2 bg-muted/30 rounded border border-dashed text-center">
            No rules added yet. Click to configure.
          </p>
        ) : (
          conditions.map((rule, idx) => (
            <div
              key={idx}
              className="relative flex items-center justify-between bg-muted/40 hover:bg-muted/70 rounded-md p-1.5 border border-border/50 text-[11px] transition-colors"
            >
              <div className="min-w-0 pr-4">
                <span className="font-semibold text-foreground truncate block">
                  {rule.name || `Rule #${idx + 1}`}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate block">
                  {rule.type.replace('_', ' ')}: &quot;{rule.value}&quot;
                </span>
              </div>

              {/* Dedicated port for this condition */}
              <Handle
                type="source"
                position={Position.Right}
                id={rule.targetNodeId || `rule_${idx}`}
                className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background hover:!scale-125 transition-transform"
                style={{ top: 'auto', transform: 'none' }}
              />
            </div>
          ))
        )}

        {/* Fallback default branch */}
        <div className="relative flex items-center justify-between bg-zinc-500/10 rounded-md p-1.5 border border-zinc-500/20 text-[11px]">
          <div>
            <span className="font-semibold text-foreground">Default Fallback</span>
            <p className="text-[10px] text-muted-foreground">When no rules match</p>
          </div>

          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="!w-3 !h-3 !bg-zinc-500 !border-2 !border-background hover:!scale-125 transition-transform"
            style={{ top: 'auto', transform: 'none' }}
          />
        </div>
      </div>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
