'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { developerApi } from '@/lib/api/developer';
import { ApiScope, ApiKeyCreatedResult, DeveloperConnection } from '@/types/developer';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: DeveloperConnection[];
  onKeyCreated: (result: ApiKeyCreatedResult) => void;
}

const AVAILABLE_SCOPES: { id: ApiScope; label: string; description: string }[] = [
  {
    id: 'messages:send',
    label: 'messages:send',
    description: 'Send text, media, and document messages',
  },
  {
    id: 'messages:read',
    label: 'messages:read',
    description: 'Read message status and delivery receipts',
  },
  {
    id: 'templates:send',
    label: 'templates:send',
    description: 'Dispatch approved Meta WhatsApp templates',
  },
  {
    id: 'templates:read',
    label: 'templates:read',
    description: 'View available WhatsApp message templates',
  },
  {
    id: 'connections:read',
    label: 'connections:read',
    description: 'List authorized WhatsApp accounts and status',
  },
  {
    id: 'contacts:read',
    label: 'contacts:read',
    description: 'Query contacts and phonebooks',
  },
  {
    id: 'usage:read',
    label: 'usage:read',
    description: 'Retrieve API usage and quota consumption',
  },
];

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  connections,
  onKeyCreated,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [expiration, setExpiration] = useState('never');
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([
    'messages:send',
    'messages:read',
    'connections:read',
  ]);
  const [allowedConnections, setAllowedConnections] = useState<string[]>([]);
  const [defaultConnection, setDefaultConnection] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(false);

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleConnection = (connId: string) => {
    setAllowedConnections((prev) =>
      prev.includes(connId) ? prev.filter((id) => id !== connId) : [...prev, connId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a descriptive key name');
      return;
    }

    if (selectedScopes.length === 0) {
      toast.error('Please select at least one permission scope');
      return;
    }

    setIsLoading(true);

    try {
      let expiresAt: string | null = null;
      const now = new Date();

      if (expiration === '30d') {
        expiresAt = new Date(now.setDate(now.getDate() + 30)).toISOString();
      } else if (expiration === '90d') {
        expiresAt = new Date(now.setDate(now.getDate() + 90)).toISOString();
      } else if (expiration === '1y') {
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
      }

      const res = await developerApi.createKey({
        name: name.trim(),
        scopes: selectedScopes,
        allowed_connections: allowedConnections.length > 0 ? allowedConnections : undefined,
        default_connection_id: defaultConnection !== 'none' ? defaultConnection : null,
        expires_at: expiresAt,
      });

      if (res.success && res.data) {
        toast.success('API key generated successfully');
        onKeyCreated(res.data);
        onOpenChange(false);
        // Reset form
        setName('');
        setExpiration('never');
        setSelectedScopes(['messages:send', 'messages:read', 'connections:read']);
        setAllowedConnections([]);
        setDefaultConnection('none');
      } else {
        toast.error('Failed to create API key');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a cryptographic key to integrate your applications with the WACRM Developer API.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Key Name */}
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Website Production, Order Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <Label>Expiration</Label>
              <Select value={expiration} onValueChange={(val) => setExpiration(val ?? 'never')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scopes */}
            <div className="space-y-2">
              <Label>Granular Scopes</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-card">
                {AVAILABLE_SCOPES.map((scope) => {
                  const isChecked = selectedScopes.includes(scope.id);
                  return (
                    <label
                      key={scope.id}
                      className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-0.5 rounded border-muted-foreground/30 text-primary focus:ring-primary h-4 w-4"
                      />
                      <div>
                        <span className="font-mono font-medium block text-foreground">
                          {scope.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {scope.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* WhatsApp Connections Authorization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Allowed WhatsApp Connections</Label>
                <span className="text-[11px] text-muted-foreground">
                  Leave unselected to allow all workspace connections
                </span>
              </div>
              {connections.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 border rounded-lg text-center">
                  No WhatsApp accounts connected yet. You can connect accounts in the WhatsApp Inbox or Integrations tab.
                </div>
              ) : (
                <div className="space-y-1.5 border rounded-lg p-3 bg-card max-h-36 overflow-y-auto">
                  {connections.map((conn) => {
                    const isChecked = allowedConnections.includes(conn.id);
                    return (
                      <label
                        key={conn.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleConnection(conn.id)}
                            className="rounded border-muted-foreground/30 text-primary h-4 w-4"
                          />
                          <span className="font-medium">{conn.name}</span>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            ({conn.phone_number || conn.id})
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                          {conn.provider}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Default Connection */}
            {connections.length > 0 && (
              <div className="space-y-1.5">
                <Label>Default WhatsApp Connection (Optional)</Label>
                <Select value={defaultConnection} onValueChange={(val) => setDefaultConnection(val ?? 'none')}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (Must specify connection_id per request)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None (Require explicit connection_id)
                    </SelectItem>
                    {connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.name} ({conn.phone_number || conn.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  If set, requests omitting <code>connection_id</code> will default to this account.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-1.5">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Generate API Key</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
