'use client';

import React, { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api/notifications';
import { adminApi } from '@/lib/api/admin';
import { BroadcastHistoryItem } from '@/types/notifications';
import { AdminPlanItem, AdminUserListItem } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import {
  Bell,
  Mail,
  Smartphone,
  Send,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  History,
  ShieldAlert,
} from 'lucide-react';

export default function AdminNotificationsPage() {
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'plan' | 'single'>('all');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [channels, setChannels] = useState<{ in_app: boolean; email: boolean; push: boolean }>({
    in_app: true,
    email: false,
    push: false,
  });

  // Double confirmation modal for broad / all users
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [allUsersConfirmed, setAllUsersConfirmed] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resHistory, resPlans, resUsers] = await Promise.all([
        notificationsApi.getBroadcastHistory(),
        adminApi.getPlans().catch(() => ({ success: false, data: [] })),
        adminApi.getUsers().catch(() => ({ success: false, data: [] })),
      ]);

      if (Array.isArray(resHistory)) {
        setHistory(resHistory);
      }
      if (resPlans && resPlans.success && Array.isArray(resPlans.data)) {
        setPlans(resPlans.data);
      }
      if (resUsers && resUsers.success && Array.isArray(resUsers.data)) {
        setUsers(resUsers.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching notification history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChannelToggle = (key: 'in_app' | 'email' | 'push') => {
    setChannels((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      // Ensure at least one channel is selected
      if (!updated.in_app && !updated.email && !updated.push) {
        return prev;
      }
      return updated;
    });
  };

  const validateForm = () => {
    if (!title.trim()) {
      alert('Please enter a notification title.');
      return false;
    }
    if (!message.trim()) {
      alert('Please enter a message body.');
      return false;
    }
    if (targetType === 'plan' && !selectedPlanId) {
      alert('Please select a target plan.');
      return false;
    }
    if (targetType === 'single' && !selectedUid) {
      alert('Please select a recipient user.');
      return false;
    }
    return true;
  };

  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setAllUsersConfirmed(false);
    setShowConfirmModal(true);
  };

  const handleExecuteSend = async () => {
    if (targetType === 'all' && !allUsersConfirmed) {
      alert('Please check the confirmation box to proceed broadcasting to all users.');
      return;
    }

    setSending(true);
    setShowConfirmModal(false);
    setError(null);
    setSuccessMsg(null);

    const channelList: ('in_app' | 'email' | 'push')[] = [];
    if (channels.in_app) channelList.push('in_app');
    if (channels.email) channelList.push('email');
    if (channels.push) channelList.push('push');

    try {
      const res = await notificationsApi.sendNotification({
        title,
        message,
        action_url: link.trim() || undefined,
        audience_type: targetType,
        target_plan_id: targetType === 'plan' ? selectedPlanId : undefined,
        target_uids: targetType === 'single' ? [selectedUid] : undefined,
        channels: channelList,
      });

      if (res && res.success) {
        setSuccessMsg(
          `Broadcast successfully dispatched to ${res.data?.sentCount ?? 1} recipient(s).`
        );
        // Reset inputs
        setTitle('');
        setMessage('');
        setLink('');
        await fetchData();
      } else {
        setError(res?.msg || 'Failed to dispatch broadcast.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while sending broadcast.');
    } finally {
      setSending(false);
    }
  };

  const renderChannelsBadges = (rawChannels: any) => {
    let list: string[] = [];
    try {
      list = typeof rawChannels === 'string' ? JSON.parse(rawChannels) : rawChannels;
    } catch {
      list = [String(rawChannels)];
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {list.map((c) => (
          <Badge key={c} variant="secondary" className="text-[10px] font-mono capitalize">
            {c === 'in_app' ? 'In-App' : c === 'email' ? 'Email' : 'Web Push'}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notification & Broadcast Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch announcements, system alerts, and notifications across In-App, Email, and Push channels.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </Button>
      </div>

      {successMsg && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Broadcast Dispatched</AlertTitle>
          <AlertDescription className="text-xs">{successMsg}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notification Error</AlertTitle>
          <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Card */}
        <Card className="lg:col-span-1 shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Compose Broadcast
            </CardTitle>
            <CardDescription className="text-xs">Configure message channels and target audience</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleInitiateSend} className="space-y-4 text-xs">
              {/* Delivery Channels */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Delivery Channels</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChannelToggle('in_app')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors ${
                      channels.in_app
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-muted bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Bell className="h-4 w-4 mb-1" />
                    <span className="text-[11px]">In-App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelToggle('email')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors ${
                      channels.email
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-muted bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Mail className="h-4 w-4 mb-1" />
                    <span className="text-[11px]">SMTP Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelToggle('push')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors ${
                      channels.push
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-muted bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1" />
                    <span className="text-[11px]">Web Push</span>
                  </button>
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'plan', 'single'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTargetType(t)}
                      className={`p-2 rounded-lg border text-center text-[11px] capitalize transition-colors ${
                        targetType === t
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-muted bg-background text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {t === 'all' ? 'All Users' : t === 'plan' ? 'By Plan' : 'Single User'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Target Filter */}
              {targetType === 'plan' && (
                <div className="space-y-1.5">
                  <Label htmlFor="target-plan" className="text-xs font-medium">
                    Select Target Plan
                  </Label>
                  <select
                    id="target-plan"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">Choose plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.title}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'single' && (
                <div className="space-y-1.5">
                  <Label htmlFor="target-user" className="text-xs font-medium">
                    Select Recipient User
                  </Label>
                  <select
                    id="target-user"
                    value={selectedUid}
                    onChange={(e) => setSelectedUid(e.target.value)}
                    required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">Select user...</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-title" className="text-xs font-medium">
                  Title / Subject
                </Label>
                <Input
                  id="broadcast-title"
                  placeholder="e.g. Scheduled Maintenance Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-body" className="text-xs font-medium">
                  Message Content
                </Label>
                <textarea
                  id="broadcast-body"
                  rows={4}
                  placeholder="Enter notification details or announcements..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Action Link */}
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-link" className="text-xs font-medium">
                  Optional Action Link
                </Label>
                <Input
                  id="broadcast-link"
                  placeholder="/dashboard/billing or https://..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={sending}
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 mt-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Dispatch Broadcast
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History Table Card */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Broadcast Transmission History
              </CardTitle>
              <CardDescription className="text-xs">
                Audited archive of all administrative notifications and announcements
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {history.length} records
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Bell className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">No broadcasts sent yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  When you send in-app alerts, emails, or push notifications, they will be tracked here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Notification</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Dispatched At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-xs">
                          <div className="font-semibold text-xs text-foreground truncate">{item.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{item.message}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            {item.audience_type === 'all'
                              ? 'All Users'
                              : item.audience_type === 'plan'
                              ? 'By Plan'
                              : 'Targeted Users'}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderChannelsBadges(item.channels)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirm Broadcast Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 mt-2">
              <p>
                You are about to dispatch <strong>&quot;{title}&quot;</strong> to{' '}
                <span className="font-semibold text-foreground">
                  {targetType === 'all'
                    ? `all registered tenants (${users.length} accounts)`
                    : targetType === 'plan'
                    ? `tenants on plan "${selectedPlanId}"`
                    : 'a single designated user'}
                </span>
                .
              </p>
              {targetType === 'all' && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 space-y-2 mt-2">
                  <p className="font-semibold text-xs">High Impact Broadcast Warning</p>
                  <label className="flex items-start gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={allUsersConfirmed}
                      onChange={(e) => setAllUsersConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-muted"
                    />
                    <span>I understand this notification will immediately be delivered to all active tenants.</span>
                  </label>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteSend}
              disabled={sending || (targetType === 'all' && !allUsersConfirmed)}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm and Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
