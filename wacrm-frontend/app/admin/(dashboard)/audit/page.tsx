'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  RefreshCw,
  Search,
  AlertTriangle,
  User,
  Settings,
  Smartphone,
  Bell,
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  admin_uid: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  ip_address: string | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLogs();
      if (res && res.success) {
        setLogs(res.data);
      } else {
        setError('Failed to load audit logs.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with audit subsystem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {});
    return (
      log.action?.toLowerCase().includes(q) ||
      log.target_type?.toLowerCase().includes(q) ||
      log.target_id?.toLowerCase().includes(q) ||
      log.admin_uid?.toLowerCase().includes(q) ||
      detailsStr.toLowerCase().includes(q)
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes('DELETE') || action.includes('BLOCK')) {
      return <Badge variant="destructive" className="text-[10px]">{action}</Badge>;
    }
    if (action.includes('UNBLOCK') || action.includes('SUCCESS') || action.includes('RECONNECT')) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
          {action}
        </Badge>
      );
    }
    if (action.includes('DISCONNECT')) {
      return <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">{action}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">{action}</Badge>;
  };

  const getActionIcon = (targetType: string) => {
    switch (targetType) {
      case 'USER':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'WHATSAPP':
        return <Smartphone className="h-4 w-4 text-violet-500" />;
      case 'NOTIFICATION':
        return <Bell className="h-4 w-4 text-amber-500" />;
      case 'SITE_SETTINGS':
        return <Settings className="h-4 w-4 text-slate-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit &amp; Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Immutable server-side trail of administrator operations, user blocks, plan modifications, and fleet events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border">
        <CardHeader className="p-4 pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, target ID, admin UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <span className="text-xs text-muted-foreground">
            {filtered.length} audit entries
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Audit Log Error</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No audit records found matching the query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Event Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target Entity</TableHead>
                    <TableHead>Actor (Admin UID)</TableHead>
                    <TableHead>Payload / Details</TableHead>
                    <TableHead className="text-right">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filtered.map((log) => {
                    let formattedDetails = '';
                    if (log.details) {
                      try {
                        const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                        formattedDetails = JSON.stringify(parsed);
                      } catch {
                        formattedDetails = String(log.details);
                      }
                    }

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.target_type)}
                            <span className="font-semibold text-foreground text-xs">
                              {log.target_type}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          {getActionBadge(log.action)}
                        </TableCell>

                        <TableCell className="py-3 font-mono text-[11px]">
                          {log.target_id || 'N/A'}
                        </TableCell>

                        <TableCell className="py-3 font-mono text-[11px] text-muted-foreground">
                          {log.admin_uid || 'system'}
                        </TableCell>

                        <TableCell className="py-3 max-w-xs truncate text-[11px] font-mono text-muted-foreground">
                          {formattedDetails || 'No additional payload'}
                        </TableCell>

                        <TableCell className="py-3 text-right text-[11px] text-muted-foreground">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
