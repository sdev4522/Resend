'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { analyticsApi } from '@/lib/api/analytics';
import { mailApi } from '@/lib/api/mail';
import { AdminPlatformAnalytics, AnalyticsRange } from '@/types/analytics';
import { AdminAuditLogItem } from '@/types/notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import { TimeSeriesChart } from '@/components/analytics/time-series-chart';
import { toast } from 'sonner';
import {
  BarChart3,
  CreditCard,
  Users,
  Smartphone,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  History,
  Send,
  Calendar,
  Layers,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const [data, setData] = useState<AdminPlatformAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        range,
        startDate: range === 'custom' && customStart ? customStart : undefined,
        endDate: range === 'custom' && customEnd ? customEnd : undefined,
      };

      const [analyticsRes, logsRes] = await Promise.all([
        analyticsApi.getAdminAnalytics(params),
        mailApi.getAuditLogs().catch(() => []),
      ]);

      if (analyticsRes) {
        setData(analyticsRes);
      } else {
        setError('Failed to fetch platform analytics.');
      }

      if (Array.isArray(logsRes)) {
        setAuditLogs(logsRes);
      }
    } catch (err: any) {
      const msg = err.message || 'Error communicating with backend.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      toast.error('Please specify both start and end dates');
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setRange('custom');
    fetchAnalytics();
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Platform God-Eye Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System-wide operational telemetry, revenue velocity, and tenant distribution strictly from the database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Range Selector */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            {(
              [
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: '7d', label: '7D' },
                { key: '30d', label: '30D' },
                { key: '90d', label: '90D' },
                { key: 'custom', label: 'Custom' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setRange(item.key);
                  setShowCustomPicker(item.key === 'custom');
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  range === item.key
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="h-8 gap-1.5 text-xs shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Range Form */}
      {(showCustomPicker || range === 'custom') && (
        <Card className="border border-border/70 bg-muted/20 p-3 shadow-2xs">
          <form onSubmit={handleApplyCustomDates} className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Platform Window:</span>
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 text-xs w-36 bg-background"
                required
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 text-xs w-36 bg-background"
                required
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs px-3">
              Filter Platform
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Platform Intelligence</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchAnalytics} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Top Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Platform Revenue */}
        <Card className="shadow-xs p-5 border">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Platform Revenue</span>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {loading ? <Skeleton className="h-8 w-28" /> : `$${(data?.revenue.totalRevenue || 0).toLocaleString()}`}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">
                ${(data?.revenue.periodRevenue || 0).toLocaleString()} in period
              </span>
              <span>•</span>
              <span>{data?.revenue.successfulOrders || 0} paid orders</span>
            </div>
          </div>
        </Card>

        {/* Registered Tenants */}
        <Card className="shadow-xs p-5 border">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Tenant Ecosystem</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {loading ? <Skeleton className="h-8 w-20" /> : (data?.users.total || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">
                {data?.users.active || 0} active
              </span>
              <span>•</span>
              <span className="text-destructive">
                {data?.users.blocked || 0} suspended
              </span>
              <span>•</span>
              <span>+{data?.users.newInPeriod || 0} new</span>
            </div>
          </div>
        </Card>

        {/* WhatsApp Nodes */}
        <Card className="shadow-xs p-5 border">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">WhatsApp Infrastructure</span>
            <Smartphone className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {loading ? <Skeleton className="h-8 w-20" /> : `${data?.whatsapp.active || 0} / ${data?.whatsapp.total || 0}`}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">
                {data?.whatsapp.qr || 0} QR sessions
              </span>
              <span>•</span>
              <span>{data?.whatsapp.meta || 0} Meta WABAs</span>
            </div>
          </div>
        </Card>

        {/* Messaging Throughput */}
        <Card className="shadow-xs p-5 border">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Message Throughput</span>
            <MessageSquare className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">
              {loading ? <Skeleton className="h-8 w-24" /> : (data?.throughput.messagesInPeriod || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 font-medium">
                {data?.throughput.incomingInPeriod.toLocaleString() || 0} in
              </span>
              <span>•</span>
              <span className="text-blue-600 font-medium">
                {data?.throughput.outgoingInPeriod.toLocaleString() || 0} out
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Charts: Acquisition Rate & Revenue Collection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Tenant Acquisition Rate
            </CardTitle>
            <CardDescription className="text-xs">
              Daily registered accounts over the selected time window.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-60 w-full" />
            ) : !data?.users.growthTimeSeries?.length ? (
              <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
                No user registrations recorded in this period.
              </div>
            ) : (
              <TimeSeriesChart
                data={data.users.growthTimeSeries}
                series={[{ key: 'count', label: 'New Tenants', color: '#3b82f6' }]}
                height={240}
              />
            )}
          </CardContent>
        </Card>

        {/* Revenue Velocity Chart */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              Platform Revenue Collection
            </CardTitle>
            <CardDescription className="text-xs">
              Daily revenue from verified payment orders in orders table.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-60 w-full" />
            ) : !data?.revenue.timeSeries?.length ? (
              <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
                No paid transactions recorded in this period.
              </div>
            ) : (
              <TimeSeriesChart
                data={data.revenue.timeSeries}
                series={[{ key: 'revenue', label: 'Revenue ($)', color: '#10b981' }]}
                valueFormatter={(v) => `$${v.toLocaleString()}`}
                height={240}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Row: Plan Distribution & Campaign Deliverability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution (1 Column) */}
        <Card className="shadow-xs border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Plan Tier Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Active tenants grouped by assigned subscription plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : !data?.users.planDistribution?.length ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No tenant plan assignments found.
              </div>
            ) : (
              data.users.planDistribution.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[160px]">
                      {item.planTitle}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {item.count} tenants
                    </span>
                  </div>
                  <Progress
                    value={
                      data.users.total > 0
                        ? Math.round((item.count / data.users.total) * 100)
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Platform Campaign Operations (2 Columns) */}
        <Card className="shadow-xs border lg:col-span-2">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Send className="h-4 w-4 text-violet-500" />
                  Platform Broadcast Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  Aggregated marketing broadcast campaigns across all workspaces.
                </CardDescription>
              </div>

              {Boolean(data?.throughput.campaignsInPeriod) && (
                <Badge variant="outline" className="text-xs font-mono">
                  {data?.throughput.campaignsInPeriod} campaigns in period
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Dispatched</span>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  {loading ? <Skeleton className="h-6 w-16 mx-auto" /> : (data?.throughput.campaignDispatches || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                <span className="text-[11px] uppercase font-semibold">Delivered</span>
                <div className="text-xl font-bold font-mono mt-1">
                  {loading ? <Skeleton className="h-6 w-16 mx-auto" /> : (data?.throughput.campaignDelivered || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600">
                <span className="text-[11px] uppercase font-semibold">Read</span>
                <div className="text-xl font-bold font-mono mt-1">
                  {loading ? <Skeleton className="h-6 w-16 mx-auto" /> : (data?.throughput.campaignRead || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                <span className="text-[11px] uppercase font-semibold">Failed</span>
                <div className="text-xl font-bold font-mono mt-1">
                  {loading ? <Skeleton className="h-6 w-16 mx-auto" /> : (data?.throughput.campaignFailed || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between text-xs text-muted-foreground">
              <span>Automations: {data?.throughput.totalFlows || 0} visual flows configured</span>
              <span>Active Chatbots: {data?.throughput.activeChatbots || 0} live bots</span>
              <span>Orders: {data?.revenue.totalOrders || 0} total ({data?.revenue.failedOrders || 0} failed)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs Table */}
      <Card className="shadow-xs border">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Administrative Audit Log
            </CardTitle>
            <CardDescription className="text-xs">
              Security audit trail for administrative actions (blocks, settings updates, broadcasts).
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {auditLogs.length} events recorded
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No audit log entries recorded yet. Actions like blocking accounts or sending broadcasts will appear here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Target</TableHead>
                  <TableHead className="text-xs font-semibold">Details</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.target_id || log.target_type || '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate text-foreground font-mono">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '—')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
