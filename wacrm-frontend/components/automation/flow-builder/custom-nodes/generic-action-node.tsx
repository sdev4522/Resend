'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Bookmark,
  Tag,
  BookUser,
  ShieldBan,
  RotateCcw,
  FileCheck,
  FormInput,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FlowNodeType } from '@/types/automation';

export const GenericActionNode = memo(({ type, data, selected }: NodeProps) => {
  const getActionConfig = () => {
    switch (type as FlowNodeType) {
      case 'RESPONSE_SAVER':
        return {
          title: 'Save Response',
          subtitle: 'Store answer to variable',
          icon: Bookmark,
          color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
          preview: ((data?.variables as any[]) || []).map((v) => v.varName).join(', ') || 'No variables mapped',
        };
      case 'SET_CHAT_LABEL':
        return {
          title: 'Set Chat Tag',
          subtitle: 'Apply CRM label',
          icon: Tag,
          color: 'text-pink-500 bg-pink-500/10 border-pink-500/30',
          preview: ((data?.labelsToAdd as any[]) || []).map((l) => l.title).join(', ') || 'Select labels...',
        };
      case 'PHONEBOOK_MANAGER':
        return {
          title: 'Contact Book',
          subtitle: `${data?.action === 'remove' ? 'Remove from' : 'Add to'} phonebook`,
          icon: BookUser,
          color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
          preview: (data?.phonebook_name as string) || `Phonebook #${data?.phonebook_id || '—'}`,
        };
      case 'DISABLE_AUTOREPLY':
        return {
          title: 'Disable Auto-Reply',
          subtitle: 'Mute bot for conversation',
          icon: ShieldBan,
          color: 'text-red-500 bg-red-500/10 border-red-500/30',
          preview: 'Hands conversation off to human agent',
        };
      case 'RESET':
        return {
          title: 'Reset Session',
          subtitle: 'Clear conversation state',
          icon: RotateCcw,
          color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30',
          preview: 'Restarts session from beginning',
        };
      case 'SEND_WA_TEMPLATE':
        return {
          title: 'WhatsApp Template',
          subtitle: 'Meta Cloud API Template',
          icon: FileCheck,
          color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
          preview: (data?.template as any)?.name || 'Approved Meta template',
        };
      case 'SEND_WA_FORM':
        return {
          title: 'WhatsApp Form',
          subtitle: 'Interactive WhatsApp Flow',
          icon: FormInput,
          color: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
          preview: (data?.waForm as any)?.name || data?.headerText || 'Customer intake form',
        };
      default:
        return {
          title: 'Action',
          subtitle: type,
          icon: Tag,
          color: 'text-muted-foreground bg-muted',
          preview: 'Configure action...',
        };
    }
  };

  const action = getActionConfig();
  const Icon = action.icon;

  return (
    <div
      className={`min-w-[240px] max-w-[300px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
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
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border shadow-2xs ${action.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">{action.title}</span>
            <p className="text-[10px] text-muted-foreground">{action.subtitle}</p>
          </div>
        </div>

        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Action
        </Badge>
      </div>

      <div className="pt-2">
        <p className="text-[11px] text-muted-foreground truncate bg-muted/30 p-1.5 rounded border border-border/40 font-mono">
          {action.preview}
        </p>
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

GenericActionNode.displayName = 'GenericActionNode';
