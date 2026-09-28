'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { AdminWhatsAppInstanceItem } from '@/types/admin';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Server,
  Smartphone,
  Cloud,
  RefreshCw,
  PowerOff,
  Trash2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminWhatsAppFleetPage() {
  const [instances, setInstances] = useState<AdminWhatsAppInstanceItem[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    qrCount: 0,
    metaCount: 0,
    activeCount: 0,
    disconnectedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Disconnect Modal
  const [disconnectItem, setDisconnectItem] = useState<AdminWhatsAppInstanceItem | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  // Delete Modal
  const [deleteItem, setDeleteItem] = useState<AdminWhatsAppInstanceItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAllInstances({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        type: typeFilter !== 'ALL' ? (typeFilter as 'QR' | 'META') : undefined,
      });

      if (res && res.success) {
        setInstances(res.data);
        if (res.summary) setSummary(res.summary);
      } else {
        setError('Failed to load platform WhatsApp instances.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend cluster.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleDisconnect = async () => {
    if (!disconnectItem) return;
    setDisconnectLoading(true);
    try {
      const res = await adminApi.disconnectInstance({
        uniqueId: disconnectItem.uniqueId,
        type: disconnectItem.type,
      });
      if (res && res.success) {
        toast.success(res.msg || `Instance ${disconnectItem.uniqueId} disconnected`);
        setDisconnectItem(null);
        fetchInstances();
      } else {
        toast.error(res?.msg || 'Failed to disconnect instance');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    } finally {
      setDisconnectLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      const res = await adminApi.deleteInstance({
        id: deleteItem.id,
        uniqueId: deleteItem.uniqueId,
        type: deleteItem.type,
      });
      if (res && res.success) {
        toast.success(res.msg || 'WhatsApp instance removed');
        setDeleteItem(null);
        fetchInstances();
      } else {
        toast.error(res?.msg || 'Failed to delete instance');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">WhatsApp Fleet Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform-wide operational telemetry across Baileys socket nodes and Meta Cloud API webhooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInstances()}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Fleet
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Fleet Nodes</span>
            <Server className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {summary.total}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary.qrCount} QR Web + {summary.metaCount} Meta Cloud
          </p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Connections</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {summary.activeCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ready for dispatches</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Disconnected Nodes</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {summary.disconnectedCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Requires QR scan</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Meta Cloud API</span>
            <Cloud className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-indigo-600">
            {summary.metaCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Official Graph API links</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border">
        <CardHeader className="p-4 pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-36">
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'ALL')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Providers</SelectItem>
                  <SelectItem value="QR" className="text-xs">QR (Baileys)</SelectItem>
                  <SelectItem value="META" className="text-xs">Meta Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'ALL')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">Active / Online</SelectItem>
                  <SelectItem value="DISCONNECTED" className="text-xs">Disconnected</SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <span className="text-xs text-muted-foreground">
            {instances.length} instances loaded
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fleet Inspection Error</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : instances.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No WhatsApp instances found matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Instance / Node</TableHead>
                    <TableHead>Provider Type</TableHead>
                    <TableHead>Phone / ID</TableHead>
                    <TableHead>Workspace Owner</TableHead>
                    <TableHead>Connection State</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Platform Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {instances.map((inst) => {
                    const isOnline = inst.status === 'ACTIVE';

                    return (
                      <TableRow key={`${inst.type}_${inst.id}`} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {inst.type === 'QR' ? (
                              <Smartphone className="h-4 w-4 text-violet-500" />
                            ) : (
                              <Cloud className="h-4 w-4 text-indigo-500" />
                            )}
                            <div>
                              <div className="font-semibold text-foreground">{inst.title}</div>
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                {inst.uniqueId}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {inst.type === 'QR' ? 'Baileys Socket' : 'Meta Cloud API'}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-3 font-mono font-medium">
                          {inst.number}
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/users/${inst.uid}`}
                              className="font-medium text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {inst.owner?.name} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                            <span className="text-[10px] text-muted-foreground">{inst.owner?.email}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          {isOnline ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Socket
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              Disconnected
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-muted-foreground text-[11px]">
                          {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : 'N/A'}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {inst.type === 'QR' && isOnline && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDisconnectItem(inst)}
                                className="h-7 text-xs px-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              >
                                <PowerOff className="h-3 w-3 mr-1" />
                                Disconnect
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteItem(inst)}
                              className="h-7 text-xs px-2 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
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
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!disconnectItem} onOpenChange={(open) => !open && setDisconnectItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-amber-600">
              <PowerOff className="h-5 w-5" />
              Sever WhatsApp Connection
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Are you sure you want to disconnect instance <strong>{disconnectItem?.title}</strong> ({disconnectItem?.number})?
              </p>
              <p className="text-muted-foreground">
                This will gracefully close the active Baileys socket on the backend server. The tenant will need to scan a new QR code to reconnect.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDisconnectItem(null)} disabled={disconnectLoading}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleDisconnect}
              disabled={disconnectLoading}
            >
              {disconnectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect Instance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Permanently Remove Instance
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Are you sure you want to remove <strong>{deleteItem?.title}</strong> ({deleteItem?.number})?
              </p>
              <p className="text-destructive">
                This action will delete the instance record from the platform database and terminate any active server sockets.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Permanently Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
