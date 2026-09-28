'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Play,
  Pause,
  Copy,
  Trash2,
  QrCode,
  Cloud,
} from 'lucide-react';
import { AutomationItem, FlowSourceType } from '@/types/automation';
import { automationApi } from '@/lib/api/automation';
import { CreateAutomationDialog } from './create-automation-dialog';
import { toast } from 'sonner';

export function AutomationList() {
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'draft'>('all');
  const [sourceFilter, _setSourceFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AutomationItem | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      const list = await automationApi.getAutomations();
      setAutomations(list);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch automations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleToggleStatus = async (item: AutomationItem) => {
    if (!item.chatbotId) {
      toast.info('Open the flow builder to configure and activate this automation.');
      return;
    }

    try {
      const nextActive = item.status !== 'active';
      await automationApi.toggleChatbotStatus(item.chatbotId, nextActive);
      toast.success(nextActive ? 'Chatbot activated' : 'Chatbot paused');
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: nextActive ? 'active' : 'inactive' } : a
        )
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update chatbot status');
    }
  };

  const handleDuplicate = async (flowId: string) => {
    try {
      await automationApi.duplicateFlow(flowId);
      toast.success('Flow duplicated successfully');
      fetchAutomations();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate flow');
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await automationApi.deleteFlow(itemToDelete.id, itemToDelete.chatbotId);
      toast.success('Automation deleted successfully');
      setAutomations((prev) => prev.filter((a) => a.id !== itemToDelete.id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete automation');
    } finally {
      setItemToDelete(null);
    }
  };

  // Filter automations
  const filteredAutomations = useMemo(() => {
    return automations.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [automations, searchQuery, statusFilter, sourceFilter]);

  const stats = useMemo(() => {
    const total = automations.length;
    const active = automations.filter((a) => a.status === 'active').length;
    const paused = automations.filter((a) => a.status === 'inactive').length;
    const drafts = automations.filter((a) => a.status === 'draft').length;
    return { total, active, paused, drafts };
  }, [automations]);

  const getSourceBadge = (source: FlowSourceType) => {
    switch (source) {
      case 'webhook_automation':
        return <Badge variant="outline" className="text-[10px]">Webhook</Badge>;
      case 'telegram_chatbot':
        return <Badge variant="outline" className="text-[10px]">Telegram</Badge>;
      case 'instagram_chatbot':
        return <Badge variant="outline" className="text-[10px]">Instagram</Badge>;
      case 'wa_chatbot':
      default:
        return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">WhatsApp</Badge>;
    }
  };

  const getStatusBadge = (status: AutomationItem['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs px-2 py-0.5 gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs px-2 py-0.5 font-medium">
            Paused
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium text-muted-foreground">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Automations
          </span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Bots
          </span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.active}</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Paused Bots
          </span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.paused}</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Draft Flows
          </span>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.drafts}</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters & CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search automations by name..."
              className="pl-8 text-xs h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            {(['all', 'active', 'inactive', 'draft'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Create Automation</span>
          </Button>
        </div>
      </div>

      {/* Automations Table or Empty State */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          Loading automations...
        </div>
      ) : automations.length === 0 ? (
        /* Honest empty state per Rule 7 */
        <div className="rounded-2xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="font-bold text-base text-foreground">No automations yet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create your first WhatsApp automation to automatically respond, route, delay, call webhooks, or perform other supported actions.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 mt-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Create Automation</span>
          </Button>
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          No automations match your search criteria.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold">Automation</TableHead>
                <TableHead className="text-xs font-bold">Trigger / Source</TableHead>
                <TableHead className="text-xs font-bold">Target Channel</TableHead>
                <TableHead className="text-xs font-bold">Status</TableHead>
                <TableHead className="text-xs font-bold">Created</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAutomations.map((item) => {
                const nodeCount = item.flowData?.nodes?.length || 0;
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Link
                        href={`/dashboard/automation/${item.flow_id}`}
                        className="font-bold text-xs text-foreground hover:text-primary transition-colors flex items-center gap-2 group"
                      >
                        <Bot className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground block pl-6">
                        {nodeCount} graph node{nodeCount !== 1 ? 's' : ''}
                      </span>
                    </TableCell>

                    <TableCell>{getSourceBadge(item.source)}</TableCell>

                    <TableCell>
                      {item.origin ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          {item.origin.code === 'QR' ? (
                            <QrCode className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Cloud className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[140px]">{item.origin.title}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>

                    <TableCell>{getStatusBadge(item.status)}</TableCell>

                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/automation/${item.flow_id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </Link>

                        {item.chatbotId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleToggleStatus(item)}
                            title={item.status === 'active' ? 'Pause Automation' : 'Resume Automation'}
                          >
                            {item.status === 'active' ? (
                              <Pause className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(item.flow_id)}
                              className="text-xs gap-2"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setItemToDelete(item)}
                              className="text-xs gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Delete automation &quot;{itemToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              This will remove the flow configuration and any associated chatbot routing.
              Existing chat logs will remain intact according to backend retention.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Automation Modal */}
      <CreateAutomationDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
