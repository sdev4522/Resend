'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  RotateCcw,
  Trash2,
  RefreshCw,
  Phone,
  Layers,
} from 'lucide-react';
import { FlowSession } from '@/types/automation';
import { automationApi } from '@/lib/api/automation';
import { toast } from 'sonner';

interface RunsViewerProps {
  flowId: string;
}

export function RunsViewer({ flowId }: RunsViewerProps) {
  const [sessions, setSessions] = useState<FlowSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await automationApi.getFlowSessions(flowId);
      setSessions(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDeleteSession = async (id: number) => {
    try {
      await automationApi.deleteFlowSession(id);
      toast.success('Session deleted');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete session');
    }
  };

  const handleResetSession = async (id: number) => {
    try {
      await automationApi.resetDisableChat(id);
      toast.success('Auto-reply reset for session');
      fetchSessions();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset session');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Active Flow Sessions</h2>
          <p className="text-xs text-muted-foreground">
            Contacts currently interacting with this automation in real-time.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={fetchSessions}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          Loading active sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-2">
          <Layers className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <h3 className="font-semibold text-sm">No Active Sessions</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            When contacts trigger this automation and interact with its nodes, their active session states will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold">Contact Mobile</TableHead>
                <TableHead className="text-xs font-bold">Channel</TableHead>
                <TableHead className="text-xs font-bold">Current Node</TableHead>
                <TableHead className="text-xs font-bold">Auto-Reply State</TableHead>
                <TableHead className="text-xs font-bold">Started At</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((sess) => {
                let parsedData: any = {};
                try {
                  parsedData = typeof sess.data === 'string' ? JSON.parse(sess.data) : sess.data;
                } catch {
                  parsedData = {};
                }

                const currentNode = parsedData?.node;
                const isChatDisabled = Boolean(parsedData?.disableChat);

                return (
                  <TableRow key={sess.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{sess.sender_mobile}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs capitalize font-medium">
                      {sess.origin || 'WhatsApp'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {currentNode ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">
                            {currentNode.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            ID: {currentNode.id}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Completed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isChatDisabled ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                          Disabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {sess.createdAt ? new Date(sess.createdAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isChatDisabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => handleResetSession(sess.id)}
                            title="Reset Auto-Reply"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSession(sess.id)}
                          title="Delete Session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
