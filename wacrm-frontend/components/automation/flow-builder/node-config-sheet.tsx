'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Copy, Plus, Upload } from 'lucide-react';
import { FlowNode, ConditionRule } from '@/types/automation';
import { automationApi } from '@/lib/api/automation';
import { toast } from 'sonner';

interface NodeConfigSheetProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updatedData: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (node: FlowNode) => void;
  isQrConnection?: boolean;
}

export function NodeConfigSheet({
  node,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  isQrConnection = false,
}: NodeConfigSheetProps) {
  const [uploading, setUploading] = useState(false);

  if (!node) return null;

  const data = node.data || {};
  const isInitialNode = node.type === 'INITIAL' || node.id === 'initialNode';

  const updateField = (field: string, value: any) => {
    onUpdateNode(node.id, {
      ...data,
      [field]: value,
    });
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    onUpdateNode(node.id, {
      ...data,
      [parent]: {
        ...(data[parent] || {}),
        [field]: value,
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const url = await automationApi.uploadMedia(file);
      const prevContent = data.content || {};
      const prevMedia = prevContent[mediaKey] || {};

      onUpdateNode(node.id, {
        ...data,
        content: {
          ...prevContent,
          type: mediaKey,
          [mediaKey]: {
            ...prevMedia,
            link: url,
            filename: file.name,
          },
        },
      });
      toast.success('Media uploaded successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Media upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Condition handlers
  const handleAddCondition = () => {
    const conditions: ConditionRule[] = [...(data.conditions || [])];
    const newIdx = conditions.length + 1;
    conditions.push({
      name: `Condition ${newIdx}`,
      type: 'text_contains',
      value: '',
      targetNodeId: `cond_${Date.now()}_${newIdx}`,
      caseSensitive: false,
    });
    updateField('conditions', conditions);
  };

  const handleRemoveCondition = (index: number) => {
    const conditions: ConditionRule[] = [...(data.conditions || [])];
    conditions.splice(index, 1);
    updateField('conditions', conditions);
  };

  const handleUpdateCondition = (index: number, updates: Partial<ConditionRule>) => {
    const conditions: ConditionRule[] = [...(data.conditions || [])];
    conditions[index] = { ...conditions[index], ...updates };
    updateField('conditions', conditions);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0 flex flex-col h-full bg-card">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border/80 sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <span>{node.type.replace('_', ' ')}</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Node ID: <code className="font-mono text-[10px]">{node.id}</code>
              </SheetDescription>
            </div>

            {!isInitialNode && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onDuplicateNode(node)}
                  title="Duplicate Node"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onDeleteNode(node.id);
                    onClose();
                  }}
                  title="Delete Node"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Configuration Body */}
        <div className="flex-1 p-4 space-y-5">
          {/* Transition Mode (Move to next node) */}
          {!isInitialNode && node.type !== 'CONDITION' && (
            <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Execution Transition</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Does flow wait for customer reply or continue immediately?
                  </p>
                </div>
                <Select
                  value={data.moveToNextNode ? 'auto' : 'wait'}
                  onValueChange={(val) => updateField('moveToNextNode', val === 'auto')}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wait" className="text-xs">
                      ⏸️ Wait for Reply
                    </SelectItem>
                    <SelectItem value="auto" className="text-xs">
                      ⚡ Continue Auto
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* INITIAL NODE */}
          {node.type === 'INITIAL' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground/80 space-y-1">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Trigger Node</p>
                <p className="text-[11px] text-muted-foreground">
                  This is the entry point of your automation. When an incoming message arrives on the connected channel, execution begins from here.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Trigger Label</Label>
                <Input
                  className="text-xs"
                  value={data.sourceTitle || 'Customer sends WhatsApp message'}
                  onChange={(e) => updateField('sourceTitle', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* SEND MESSAGE NODE */}
          {node.type === 'SEND_MESSAGE' && (
            <div className="space-y-4">
              {/* Text Message */}
              {data.type?.type === 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Message Text</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-1.5"
                        onClick={() => {
                          const current = data.content?.text?.body || '';
                          updateNestedField('content', 'text', {
                            ...(data.content?.text || {}),
                            body: current + ' {{senderName}}',
                          });
                        }}
                      >
                        + &#123;&#123;name&#125;&#125;
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-1.5"
                        onClick={() => {
                          const current = data.content?.text?.body || '';
                          updateNestedField('content', 'text', {
                            ...(data.content?.text || {}),
                            body: current + ' {{senderMobile}}',
                          });
                        }}
                      >
                        + &#123;&#123;phone&#125;&#125;
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={4}
                    className="text-xs leading-relaxed font-sans"
                    placeholder="Type message text here. Use {{variable}} for dynamic data..."
                    value={data.content?.text?.body || ''}
                    onChange={(e) =>
                      updateNestedField('content', 'text', {
                        ...(data.content?.text || {}),
                        body: e.target.value,
                        preview_url: true,
                      })
                    }
                  />
                </div>
              )}

              {/* Media Messages (Image, Video, Audio, Document) */}
              {['image', 'video', 'audio', 'document'].includes(data.type?.type) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold capitalize">
                      {data.type?.type} URL
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        className="text-xs font-mono"
                        placeholder={`https://example.com/${data.type?.type}.ext`}
                        value={data.content?.[data.type?.type]?.link || ''}
                        onChange={(e) =>
                          updateNestedField('content', data.type?.type, {
                            ...(data.content?.[data.type?.type] || {}),
                            link: e.target.value,
                          })
                        }
                      />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, data.type?.type)}
                          disabled={uploading}
                        />
                        <span className="inline-flex items-center justify-center h-9 px-2 text-xs rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium shrink-0 cursor-pointer">
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          {uploading ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {data.type?.type !== 'audio' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Caption (Optional)</Label>
                      <Input
                        className="text-xs"
                        placeholder="Add a caption to the media..."
                        value={data.content?.[data.type?.type]?.caption || ''}
                        onChange={(e) =>
                          updateNestedField('content', data.type?.type, {
                            ...(data.content?.[data.type?.type] || {}),
                            caption: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}

                  {data.type?.type === 'document' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">File Name</Label>
                      <Input
                        className="text-xs"
                        placeholder="Document.pdf"
                        value={data.content?.document?.filename || 'document.pdf'}
                        onChange={(e) =>
                          updateNestedField('content', 'document', {
                            ...(data.content?.document || {}),
                            filename: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Button Message */}
              {data.type?.type === 'button' && (
                <div className="space-y-3">
                  {isQrConnection && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
                      ⚠️ Interactive buttons are not supported on WhatsApp QR connections. They require Meta Cloud API.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Message Body</Label>
                    <Textarea
                      rows={3}
                      className="text-xs"
                      placeholder="Please choose an option:"
                      value={data.content?.interactive?.body?.text || ''}
                      onChange={(e) => {
                        const prevInteractive = data.content?.interactive || { type: 'button' };
                        updateNestedField('content', 'interactive', {
                          ...prevInteractive,
                          type: 'button',
                          body: { text: e.target.value },
                          action: prevInteractive.action || { buttons: [] },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Buttons (Max 3)</Label>
                      {((data.content?.interactive?.action?.buttons as any[]) || []).length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => {
                            const prev = data.content?.interactive?.action?.buttons || [];
                            const newBtn = {
                              type: 'reply',
                              reply: {
                                id: `btn_${Date.now()}`,
                                title: `Option ${prev.length + 1}`,
                              },
                            };
                            const prevInteractive = data.content?.interactive || { type: 'button' };
                            updateNestedField('content', 'interactive', {
                              ...prevInteractive,
                              type: 'button',
                              body: prevInteractive.body || { text: '' },
                              action: { buttons: [...prev, newBtn] },
                            });
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Button
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {((data.content?.interactive?.action?.buttons as any[]) || []).map(
                        (b: any, bIdx: number) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <Input
                              className="text-xs h-8"
                              placeholder="Button Title (max 20 chars)"
                              maxLength={20}
                              value={b.reply?.title || ''}
                              onChange={(e) => {
                                const buttons = [
                                  ...(data.content?.interactive?.action?.buttons || []),
                                ];
                                buttons[bIdx] = {
                                  ...buttons[bIdx],
                                  reply: { ...buttons[bIdx].reply, title: e.target.value },
                                };
                                const prevInteractive = data.content?.interactive || {};
                                updateNestedField('content', 'interactive', {
                                  ...prevInteractive,
                                  action: { ...prevInteractive.action, buttons },
                                });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive shrink-0"
                              onClick={() => {
                                const buttons = [
                                  ...(data.content?.interactive?.action?.buttons || []),
                                ];
                                buttons.splice(bIdx, 1);
                                const prevInteractive = data.content?.interactive || {};
                                updateNestedField('content', 'interactive', {
                                  ...prevInteractive,
                                  action: { ...prevInteractive.action, buttons },
                                });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* List Message */}
              {data.type?.type === 'list' && (
                <div className="space-y-3">
                  {isQrConnection && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
                      ⚠️ List menus are not supported on WhatsApp QR connections. They require Meta Cloud API.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Header (Optional)</Label>
                    <Input
                      className="text-xs"
                      placeholder="Menu Header"
                      value={data.content?.interactive?.header?.text || ''}
                      onChange={(e) => {
                        const prevInteractive = data.content?.interactive || { type: 'list' };
                        updateNestedField('content', 'interactive', {
                          ...prevInteractive,
                          type: 'list',
                          header: { type: 'text', text: e.target.value },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Body Text</Label>
                    <Textarea
                      rows={2}
                      className="text-xs"
                      placeholder="Please choose from the menu below:"
                      value={data.content?.interactive?.body?.text || ''}
                      onChange={(e) => {
                        const prevInteractive = data.content?.interactive || { type: 'list' };
                        updateNestedField('content', 'interactive', {
                          ...prevInteractive,
                          type: 'list',
                          body: { text: e.target.value },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Menu Button Title</Label>
                    <Input
                      className="text-xs"
                      placeholder="View Options"
                      value={data.content?.interactive?.action?.button || 'View Options'}
                      onChange={(e) => {
                        const prevInteractive = data.content?.interactive || { type: 'list' };
                        updateNestedField('content', 'interactive', {
                          ...prevInteractive,
                          type: 'list',
                          action: {
                            ...(prevInteractive.action || {}),
                            button: e.target.value,
                          },
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONDITION NODE */}
          {node.type === 'CONDITION' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Condition Rules</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAddCondition}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {((data.conditions as ConditionRule[]) || []).map((rule, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <Input
                        className="text-xs font-semibold h-7 w-[160px]"
                        value={rule.name}
                        onChange={(e) => handleUpdateCondition(idx, { name: e.target.value })}
                        placeholder="Rule Name"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRemoveCondition(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={rule.type}
                        onValueChange={(val: any) => handleUpdateCondition(idx, { type: val })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text_contains" className="text-xs">Contains</SelectItem>
                          <SelectItem value="text_exact" className="text-xs">Equals</SelectItem>
                          <SelectItem value="text_starts_with" className="text-xs">Starts With</SelectItem>
                          <SelectItem value="text_ends_with" className="text-xs">Ends With</SelectItem>
                          <SelectItem value="number_equals" className="text-xs">Number =</SelectItem>
                          <SelectItem value="number_greater" className="text-xs">Number &gt;</SelectItem>
                          <SelectItem value="number_less" className="text-xs">Number &lt;</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        className="text-xs h-7"
                        placeholder="Match Value"
                        value={rule.value}
                        onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELAY NODE */}
          {node.type === 'DELAY' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Delay Duration (Seconds)</Label>
                <Input
                  type="number"
                  min={1}
                  max={86400}
                  className="text-xs font-mono"
                  value={data.seconds || 5}
                  onChange={(e) => updateField('seconds', parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 30, 60, 300].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={data.seconds === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => updateField('seconds', s)}
                  >
                    {s < 60 ? `${s}s` : `${s / 60}m`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* WEBHOOK REQUEST NODE (MAKE_REQUEST) */}
          {node.type === 'MAKE_REQUEST' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">HTTP Method</Label>
                <Select
                  value={data.method || 'POST'}
                  onValueChange={(val) => updateField('method', val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET" className="text-xs">GET</SelectItem>
                    <SelectItem value="POST" className="text-xs">POST</SelectItem>
                    <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                    <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                    <SelectItem value="PATCH" className="text-xs">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Request URL</Label>
                <Input
                  className="text-xs font-mono"
                  placeholder="https://api.yourdomain.com/v1/webhook"
                  value={data.url || ''}
                  onChange={(e) => updateField('url', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Supports variable substitution like <code>&#123;&#123;&#123;senderMobile&#125;&#125;&#125;</code>
                </p>
              </div>
            </div>
          )}

          {/* AI AGENT RESPONSE NODE (AI_TRANSFER) */}
          {node.type === 'AI_TRANSFER' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Model</Label>
                <Select
                  value={data.model || 'gpt-4o'}
                  onValueChange={(val) => updateField('model', val)}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o" className="text-xs font-mono">gpt-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini" className="text-xs font-mono">gpt-4o-mini</SelectItem>
                    <SelectItem value="gemini-1.5-pro" className="text-xs font-mono">gemini-1.5-pro</SelectItem>
                    <SelectItem value="deepseek-chat" className="text-xs font-mono">deepseek-chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">System Instructions / Prompt</Label>
                <Textarea
                  rows={4}
                  className="text-xs font-sans"
                  placeholder="Provide personality, guidelines, and instructions for the AI..."
                  value={data.instruction || ''}
                  onChange={(e) => updateField('instruction', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Message Memory Depth</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="text-xs"
                  value={data.messageReferenceCount || 10}
                  onChange={(e) =>
                    updateField('messageReferenceCount', parseInt(e.target.value, 10) || 10)
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Number of past conversation messages sent to AI for context
                </p>
              </div>
            </div>
          )}

          {/* RESPONSE SAVER NODE */}
          {node.type === 'RESPONSE_SAVER' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-1">
                <p className="font-semibold text-foreground">Capture User Reply</p>
                <p className="text-[10px] text-muted-foreground">
                  Stores customer&apos;s answer into variable so later nodes can reference it using <code>&#123;&#123;varName&#125;&#125;</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Variable Name</Label>
                <Input
                  className="text-xs font-mono"
                  placeholder="e.g. userEmail, leadBudget"
                  value={data.variables?.[0]?.varName || ''}
                  onChange={(e) =>
                    updateField('variables', [
                      {
                        varName: e.target.value,
                        responsePath: 'message.senderMessage',
                      },
                    ])
                  }
                />
              </div>
            </div>
          )}

          {/* SET CHAT LABEL */}
          {node.type === 'SET_CHAT_LABEL' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tag Name</Label>
                <Input
                  className="text-xs"
                  placeholder="e.g. VIP Lead, Qualified"
                  value={data.labelsToAdd?.[0]?.title || ''}
                  onChange={(e) =>
                    updateField('labelsToAdd', [
                      {
                        id: Date.now(),
                        title: e.target.value,
                        hex: '#3B82F6',
                      },
                    ])
                  }
                />
              </div>
            </div>
          )}

          {/* PHONEBOOK MANAGER */}
          {node.type === 'PHONEBOOK_MANAGER' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Action</Label>
                <Select
                  value={data.action || 'add'}
                  onValueChange={(val) => updateField('action', val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add" className="text-xs">Add Contact to Book</SelectItem>
                    <SelectItem value="remove" className="text-xs">Remove Contact from Book</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phonebook ID</Label>
                <Input
                  type="number"
                  className="text-xs font-mono"
                  placeholder="Phonebook ID"
                  value={data.phonebook_id || ''}
                  onChange={(e) => updateField('phonebook_id', parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-border/80 sticky bottom-0 bg-card">
          <Button className="w-full text-xs" onClick={onClose}>
            Done Configuring
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
