'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { AdminWorkspaceItem } from '@/types/admin';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Users,
  Smartphone,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalWorkspaces, setTotalWorkspaces] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Suspend/Activate Workspace dialog
  const [actionWorkspace, setActionWorkspace] = useState<AdminWorkspaceItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getWorkspaces({
        search: searchQuery.trim(),
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });

      if (res && res.success) {
        setWorkspaces(res.data);
        setTotalWorkspaces(res.pagination?.total || res.data.length);
      } else {
        setError((res as any)?.msg || 'Failed to load platform workspaces.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend server.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleToggleSuspend = async () => {
    if (!actionWorkspace) return;
    setActionLoading(true);
    try {
      const newBlockedState = !actionWorkspace.is_blocked;
      const res = await adminApi.toggleUserStatus(actionWorkspace.uid, newBlockedState);
      if (res && res.success) {
        toast.success(
          newBlockedState
            ? `Workspace "${actionWorkspace.name}" suspended`
            : `Workspace "${actionWorkspace.name}" reactivated`
        );
        setActionWorkspace(null);
        fetchWorkspaces();
      } else {
        toast.error(res?.msg || 'Failed to update workspace status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalWorkspaces / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            God-Mode platform view of all tenant workspaces, owners, team members, and resource quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWorkspaces()}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Workspaces</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {totalWorkspaces.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Customer tenant environments</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Tenants</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {workspaces.filter((w) => !w.is_blocked).length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">On current page</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Suspended</span>
            <ShieldBan className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {workspaces.filter((w) => w.is_blocked).length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Access disabled</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Fleet Connected</span>
            <Smartphone className="h-4 w-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {workspaces.reduce((acc, w) => acc + (w.stats?.totalInstances || 0), 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">WhatsApp connections</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border">
        <CardHeader className="p-4 pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by workspace name, owner email, UID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <span className="text-xs text-muted-foreground">
            Showing {workspaces.length} of {totalWorkspaces} workspaces
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Failed to load workspaces</AlertTitle>
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
          ) : workspaces.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No workspaces found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Workspace / Owner</TableHead>
                    <TableHead>Active Plan</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>WhatsApp Instances</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {workspaces.map((ws) => (
                    <TableRow key={ws.uid} className="hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/users/${ws.uid}`}
                            className="font-semibold text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {ws.name || 'Untitled Workspace'}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">{ws.email}</span>
                          <span className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                            UID: {ws.uid.slice(0, 14)}...
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-medium text-[11px]">
                          {ws.planTitle}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 font-mono">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{ws.stats?.members || 0}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {ws.stats?.qrInstances || 0} QR
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {ws.stats?.metaInstances || 0} Meta
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 font-mono">
                        {(ws.stats?.contacts || 0).toLocaleString()}
                      </TableCell>

                      <TableCell className="py-3">
                        {ws.is_blocked ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/users/${ws.uid}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
                              Inspect <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActionWorkspace(ws)}
                            className={`h-7 text-xs px-2 ${
                              ws.is_blocked ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'
                            }`}
                          >
                            {ws.is_blocked ? 'Activate' : 'Suspend'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 gap-1 text-xs"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend / Reactivate Confirmation Dialog */}
      <Dialog open={!!actionWorkspace} onOpenChange={(open) => !open && setActionWorkspace(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {actionWorkspace?.is_blocked ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Reactivate Workspace
                </>
              ) : (
                <>
                  <ShieldBan className="h-5 w-5 text-red-500" />
                  Suspend Workspace Access
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Target Workspace: <strong>{actionWorkspace?.name}</strong> ({actionWorkspace?.email})
              </p>
              {actionWorkspace?.is_blocked ? (
                <p className="text-muted-foreground">
                  Reactivating will allow the workspace owner and agents to log in and resume campaign dispatches.
                </p>
              ) : (
                <p className="text-muted-foreground text-red-600 dark:text-red-400">
                  Suspension will invalidate active JWT sessions immediately and pause ongoing campaign processing until reactivated.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setActionWorkspace(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant={actionWorkspace?.is_blocked ? 'default' : 'destructive'}
              onClick={handleToggleSuspend}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionWorkspace?.is_blocked ? 'Confirm Reactivation' : 'Confirm Suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
