'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode, Cloud, Bot, ArrowRight, AlertCircle } from 'lucide-react';
import { FlowSourceType, OriginObject } from '@/types/automation';
import { automationApi } from '@/lib/api/automation';
import { toast } from 'sonner';

interface CreateAutomationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateAutomationDialog({ isOpen, onClose }: CreateAutomationDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [source, setSource] = useState<FlowSourceType>('wa_chatbot');
  const [origins, setOrigins] = useState<OriginObject[]>([]);
  const [selectedOriginCode, setSelectedOriginCode] = useState<string>('META');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      automationApi
        .getOrigins()
        .then((list) => {
          setOrigins(list);
          if (list.length > 0) {
            setSelectedOriginCode(list[0].code === 'QR' ? list[0].data?.uniqueId || list[0].code : list[0].code);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter an automation name');
      return;
    }

    try {
      setIsSubmitting(true);
      // Generate clean 32-char alphanumeric flow_id
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let flowId = '';
      for (let i = 0; i < 32; i++) {
        flowId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const selectedOrigin = origins.find(
        (o) => o.code === selectedOriginCode || o.data?.uniqueId === selectedOriginCode
      );

      const welcomeNodeId = `node_msg_${Date.now()}`;
      const initialData = {
        nodes: [
          {
            id: 'initialNode',
            type: 'INITIAL' as const,
            position: { x: 100, y: 300 },
            data: {
              whPhonePath: '',
              sourceSlug: source,
              sourceTitle: selectedOrigin?.title
                ? `Customer messages ${selectedOrigin.title}`
                : 'Customer sends WhatsApp message',
            },
          },
          {
            id: welcomeNodeId,
            type: 'SEND_MESSAGE' as const,
            position: { x: 420, y: 300 },
            data: {
              type: 'text',
              text: 'Hello! Welcome to our service. How can we help you today?',
            },
          },
        ],
        edges: [
          {
            id: 'edge_init_to_msg',
            source: 'initialNode',
            target: welcomeNodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'var(--primary)', strokeWidth: 2 },
          },
        ],
      };

      await automationApi.saveFlow({
        name: name.trim(),
        flow_id: flowId,
        source,
        data: initialData,
      });

      toast.success('Automation draft created');
      onClose();
      router.push(`/dashboard/automation/${flowId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create automation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOrigin = origins.find(
    (o) => o.code === selectedOriginCode || o.data?.uniqueId === selectedOriginCode
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span>Create New Automation</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure basic trigger and connection details, then build your flow visually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Automation Name</Label>
              <Input
                placeholder="e.g. Lead Qualification, Support Router"
                className="text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Trigger / Source Type</Label>
              <Select
                value={source}
                onValueChange={(val) => {
                  if (val) setSource(val as FlowSourceType);
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wa_chatbot" className="text-xs">
                    WhatsApp Chatbot (Primary)
                  </SelectItem>
                  <SelectItem value="webhook_automation" className="text-xs">
                    Webhook Triggered Flow
                  </SelectItem>
                  <SelectItem value="telegram_chatbot" className="text-xs">
                    Telegram Chatbot
                  </SelectItem>
                  <SelectItem value="instagram_chatbot" className="text-xs">
                    Instagram DM Chatbot
                  </SelectItem>
                  <SelectItem value="messenger_chatbot" className="text-xs">
                    Messenger Chatbot
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source === 'wa_chatbot' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">WhatsApp Connection Target</Label>
                <Select
                  value={selectedOriginCode}
                  onValueChange={(val) => {
                    if (val) setSelectedOriginCode(val);
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((orig, idx) => (
                      <SelectItem
                        key={idx}
                        value={orig.code === 'QR' ? orig.data?.uniqueId || orig.title : orig.code}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {orig.code === 'QR' ? (
                            <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Cloud className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          <span>{orig.title}</span>
                          <span className="text-[10px] text-muted-foreground">({orig.code})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedOrigin?.code === 'QR' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 mt-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">WhatsApp QR Instance Notice</p>
                      <p className="text-[10px] opacity-90">
                        Interactive buttons and lists are only supported on Meta Cloud API. This flow will use standard text messages, media, and conditions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Creating...' : 'Open Flow Builder'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
