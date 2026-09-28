'use client';

import React, { useState } from 'react';
import { ApiKey, DeveloperConnection } from '@/types/developer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { developerApi } from '@/lib/api/developer';
import { toast } from 'sonner';
import { Plus, Key } from 'lucide-react';
import { format } from 'date-fns';

interface ApiKeysTableProps {
  keys: ApiKey[];
  connections: DeveloperConnection[];
  onRefresh: () => void;
  onCreateOpen: () => void;
}

export function ApiKeysTable({
  keys,
  connections,
  onRefresh,
  onCreateOpen,
}: ApiKeysTableProps) {
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    setIsRevoking(true);
    try {
      const res = await developerApi.revokeKey(revokeTarget.id);
      if (res.success) {
        toast.success(`API key "${revokeTarget.name}" has been revoked`);
        setRevokeTarget(null);
        onRefresh();
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    } finally {
      setIsRevoking(false);
    }
  };

  const getConnectionName = (connId?: string | null) => {
    if (!connId) return 'None';
    const match = connections.find((c) => c.id === connId);
    return match ? `${match.name} (${match.phone_number || connId})` : connId;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Active API Keys</h3>
          <p className="text-xs text-muted-foreground">
            Manage developer API keys used by external systems and automated workflows.
          </p>
        </div>
        <Button onClick={onCreateOpen} size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Create New Key</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Default Account</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Key className="h-6 w-6 text-muted-foreground/40 mb-1" />
                    <p className="font-medium">No API keys created yet</p>
                    <p className="text-xs">Create your first key to start sending messages via REST API.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => {
                const isActive = key.status === 'active';
                const isRevoked = key.status === 'revoked';
                const isExpired = key.status === 'expired';

                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary shrink-0" />
                        <span>{key.name}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {key.key_prefix}••••••••
                      </code>
                    </TableCell>

                    <TableCell>
                      {isActive && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
                          Active
                        </Badge>
                      )}
                      {isRevoked && (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px]">
                          Revoked
                        </Badge>
                      )}
                      {isExpired && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px]">
                          Expired
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {key.scopes?.slice(0, 3).map((scope) => (
                          <span
                            key={scope}
                            className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-mono"
                          >
                            {scope}
                          </span>
                        ))}
                        {(key.scopes?.length || 0) > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                            +{key.scopes.length - 3} more
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                      {getConnectionName(key.default_connection_id)}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {key.created_at ? format(new Date(key.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {key.last_used_at ? format(new Date(key.last_used_at), 'MMM d, HH:mm') : 'Never'}
                    </TableCell>

                    <TableCell className="text-right">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                          onClick={() => setRevokeTarget(key)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Revocation Confirmation Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke &quot;{revokeTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? Any applications or integrations currently using this key will immediately stop working. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
