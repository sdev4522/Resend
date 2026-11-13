'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  MessageSquare,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  List,
  Sparkles,
  ArrowRight,
  PauseCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const MessageNode = memo(({ data, selected }: NodeProps) => {
  const msgType = (data?.type as any)?.type || 'text';
  const content = (data?.content as any) || {};
  const moveToNextNode = Boolean(data?.moveToNextNode);

  const getSubtypeInfo = () => {
    switch (msgType) {
      case 'image':
        return {
          icon: ImageIcon,
          color: 'text-warning bg-warning/10 border-warning/30',
          title: 'Send Image',
          preview: content.image?.caption || content.image?.link || 'No image URL set',
        };
      case 'video':
        return {
          icon: Video,
          color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
          title: 'Send Video',
          preview: content.video?.caption || content.video?.link || 'No video URL set',
        };
      case 'audio':
        return {
          icon: Mic,
          color: 'text-destructive bg-destructive/10 border-destructive/30',
          title: 'Send Audio',
          preview: content.audio?.link || 'Voice note audio',
        };
      case 'document':
        return {
          icon: FileText,
          color: 'text-info bg-info/10 border-info/30',
          title: 'Send Document',
          preview: content.document?.filename || content.document?.caption || content.document?.link || 'PDF/Document',
        };
      case 'button':
        return {
          icon: Sparkles,
          color: 'text-info bg-info/10 border-info/30',
          title: 'Reply Buttons',
          preview: content.interactive?.body?.text || 'Interactive buttons',
        };
      case 'list':
        return {
          icon: List,
          color: 'text-success bg-success/10 border-success/30',
          title: 'List Menu',
          preview: content.interactive?.body?.text || 'Interactive list menu',
        };
      case 'text':
      default:
        return {
          icon: MessageSquare,
          color: 'text-info bg-info/10 border-info/30',
          title: 'Send Text',
          preview: content.text?.body || 'Enter message text...',
        };
    }
  };

  const subtype = getSubtypeInfo();
  const Icon = subtype.icon;

  return (
    <div
      className={`min-w-[250px] max-w-[320px] rounded-xl border bg-card p-3 shadow-xs transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border hover:border-border/80'
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
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border shadow-2xs ${subtype.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-foreground">{subtype.title}</span>
            <p className="text-xs text-muted-foreground capitalize">{msgType} message</p>
          </div>
        </div>

        <Badge
          variant="secondary"
          className="text-xs px-1.5 py-0 font-normal flex items-center gap-1"
        >
          {moveToNextNode ? (
            <>
              <ArrowRight className="h-2.5 w-2.5 text-info" />
              <span>Next</span>
            </>
          ) : (
            <>
              <PauseCircle className="h-2.5 w-2.5 text-warning" />
              <span>Waits</span>
            </>
          )}
        </Badge>
      </div>

      <div className="pt-2">
        <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed bg-muted/30 rounded-md p-1.5 border border-border/40 font-sans">
          {subtype.preview}
        </p>

        {msgType === 'button' && (content.interactive?.action?.buttons?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {content.interactive.action.buttons.map((b: any, i: number) => (
              <span
                key={i}
                className="text-xs bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded-md truncate max-w-[120px]"
              >
                🔘 {b.reply?.title || 'Button'}
              </span>
            ))}
          </div>
        )}

        {msgType === 'list' && (content.interactive?.action?.sections?.length ?? 0) > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            📋 {content.interactive.action.sections.length} Section(s) configured
          </div>
        )}
      </div>

      {/* Outgoing port */}
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background hover:!scale-125 transition-transform"
      />
    </div>
  );
});

MessageNode.displayName = 'MessageNode';
