'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsApi } from '@/lib/api/analytics';
import { adminApi } from '@/lib/api/admin';
import { AdminUserDetails } from '@/types/analytics';
import { AdminPlanItem } from '@/types/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  ArrowLeft,
  RefreshCw,
  LogIn,
  ShieldBan,
  ShieldCheck,
  Package,
  Users as UsersIcon,
  Smartphone,
  Workflow,
  Bot,
  CreditCard,
  Send,
  Calendar,
  Phone,
  Globe,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export default function AdminUserInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const uid = resolvedParams.id;

  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Block Modal
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Plan Modal
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [planLoading, setPlanLoading] = useState(false);

  // Impersonate
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  const fetchUserDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resDetails, resPlans] = await Promise.all([
        analyticsApi.getUserDetails(uid),
        adminApi.getPlans().catch(() => ({ success: false, data: [] })),
      ]);

      if (resDetails) {
        setDetails(resDetails);
      } else {
        setError('Failed to load user profile or user does not exist.');
      }

      if (resPlans && resPlans.success && Array.isArray(resPlans.data)) {
        setPlans(resPlans.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchUserDetails();
    }
  }, [uid]);

  const showBanner = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleToggleBlock = async () => {
    if (!details?.user) return;
    setBlockLoading(true);
    try {
      const isCurrentlyBlocked = Boolean(details.user.is_blocked);
      const res = await adminApi.toggleUserStatus(details.user.uid, !isCurrentlyBlocked);
      if (res && res.success) {
        setShowBlockDialog(false);
        showBanner(
          !isCurrentlyBlocked
            ? `User ${details.user.email} blocked and sessions revoked.`
            : `User ${details.user.email} unblocked.`
        );
        await fetchUserDetails();
      } else {
        alert(res?.msg || 'Failed to update user status.');
      }
    } catch (err: any) {
      alert(err.message || 'Server error.');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details?.user || selectedPlanId === '') return;

    const chosen = plans.find((p) => p.id === Number(selectedPlanId));
    if (!chosen) return;

    setPlanLoading(true);
    try {
      const res = await adminApi.updateUserPlan(details.user.uid, {
        id: chosen.id,
        title: chosen.title,
      });
      if (res && res.success) {
        setShowPlanDialog(false);
        showBanner(`Plan updated to "${chosen.title}" for ${details.user.email}`);
        await fetchUserDetails();
      } else {
        alert(res?.msg || 'Failed to change plan.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating plan.');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!details?.user) return;
    setImpersonateLoading(true);
    try {
      const res = await adminApi.autoLoginAsUser(details.user.uid);
      if (res && res.success) {
        window.location.href = '/dashboard';
      } else {
        alert(res?.msg || 'Impersonation failed.');
        setImpersonateLoading(false);
      }
    } catch (err: any) {
      alert(err.message || 'Server error.');
      setImpersonateLoading(false);
    }
  };

  const parsePlan = (plan: any) => {
    if (!plan) return 'Default Free Plan';
    try {
      const parsed = typeof plan === 'string' ? JSON.parse(plan) : plan;
      return parsed.title || 'Custom Plan';
    } catch {
      return 'Standard Plan';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading User</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <span>{error || 'User not found.'}</span>
            <Button variant="outline" size="sm" onClick={fetchUserDetails} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { user, stats, instances, recentOrders } = details;
  const isBlocked = Boolean(user.is_blocked);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/users')} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{user.name || 'User Account'}</h1>
              {isBlocked ? (
                <Badge variant="destructive" className="text-xs">
                  Blocked
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Active Account
                </Badge>
              )}
              <Badge variant="secondary" className="font-mono text-xs">
                {(user.role || 'user').toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">UID: {user.uid}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImpersonate}
            disabled={impersonateLoading}
            className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-1.5"
          >
            {impersonateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Login as User
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedPlanId('');
              setShowPlanDialog(true);
            }}
            className="gap-1.5"
          >
            <Package className="h-3.5 w-3.5" />
            Change Plan
          </Button>

          <Button
            variant={isBlocked ? 'default' : 'destructive'}
            size="sm"
            onClick={() => setShowBlockDialog(true)}
            className="gap-1.5"
          >
            {isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldBan className="h-3.5 w-3.5" />}
            {isBlocked ? 'Unblock User' : 'Block User'}
          </Button>

          <Button variant="ghost" size="sm" onClick={fetchUserDetails} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Profile Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">User Information</CardTitle>
            <CardDescription className="text-xs">Identity and contact specifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b">
              <Avatar className="h-12 w-12 border">
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {(user.name || 'U').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <div className="font-semibold text-sm truncate">{user.name}</div>
                <div className="text-muted-foreground truncate">{user.email}</div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Mobile
                </span>
                <span className="font-mono">{user.mobile_with_country_code || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Current Plan
                </span>
                <Badge variant="outline">{parsePlan(user.plan)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Timezone
                </span>
                <span>{user.timezone || 'UTC'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Registered
                </span>
                <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real Metrics Grid */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Contacts</span>
              <UsersIcon className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">{(stats?.contactsCount || 0).toLocaleString()}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Audience address book</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">WhatsApp Instances</span>
              <Smartphone className="h-4 w-4 text-violet-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">
                {(stats?.instancesCount || 0).toLocaleString()}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Connected numbers</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Campaigns</span>
              <Send className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">{(stats?.campaignsCount || 0).toLocaleString()}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Broadcast deliveries</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Automations / Flows</span>
              <Workflow className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">{(stats?.flowsCount || 0).toLocaleString()}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active canvas flows</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Chatbot Rules</span>
              <Bot className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">{(stats?.chatbotsCount || 0).toLocaleString()}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Auto-responder triggers</p>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Orders / Transactions</span>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-foreground">{(stats?.ordersCount || 0).toLocaleString()}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Billing payments</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs / Detailed Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WhatsApp Instances Card */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-500" />
                  WhatsApp Sessions ({instances.length})
                </CardTitle>
                <CardDescription className="text-xs">Numbers linked by this workspace</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {instances.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No WhatsApp numbers connected yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Number / Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="font-medium text-foreground">{inst.number || inst.title || 'Instance'}</div>
                        <div className="text-[11px] text-muted-foreground">{inst.uniqueId}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={inst.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={`text-[10px] ${
                            inst.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : ''
                          }`}
                        >
                          {inst.status || 'OFFLINE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inst.createdAt ? new Date(inst.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment Orders */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Subscription & Orders ({recentOrders.length})
                </CardTitle>
                <CardDescription className="text-xs">Billing transactions recorded in database</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No payment orders recorded.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((ord, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-mono font-semibold">${ord.amount || 0}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{ord.payment_mode || 'GATEWAY'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={ord.status === 'SUCCESS' || ord.status === 'PAID' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {ord.status || 'PENDING'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Block / Unblock Modal */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {isBlocked ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Unblock Account
                </>
              ) : (
                <>
                  <ShieldBan className="h-5 w-5 text-destructive" />
                  Block Account
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBlocked
                ? `Restore full platform access for ${user.name} (${user.email})?`
                : `Are you sure you want to block ${user.name} (${user.email})? Existing sessions will be terminated and all subsequent API requests will receive HTTP 403 Forbidden.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)} disabled={blockLoading}>
              Cancel
            </Button>
            <Button
              variant={isBlocked ? 'default' : 'destructive'}
              onClick={handleToggleBlock}
              disabled={blockLoading}
            >
              {blockLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBlocked ? 'Confirm Unblock' : 'Confirm Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Modal */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleChangePlanSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Change Subscription Plan
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select a plan to assign to {user.name} ({user.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <Label htmlFor="inspector-plan-select" className="text-xs font-medium">
                Choose Plan
              </Label>
              <select
                id="inspector-plan-select"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.price === 0 ? 'Free' : `$${p.price}`}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowPlanDialog(false)} disabled={planLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={planLoading || selectedPlanId === ''} className="bg-red-600 hover:bg-red-700 text-white">
                {planLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
