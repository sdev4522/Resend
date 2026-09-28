'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '@/lib/api/analytics';
import { UserWorkspaceAnalytics, AnalyticsRange } from '@/types/analytics';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TimeSeriesChart } from '@/components/analytics/time-series-chart';
import { toast } from 'sonner';
import {
  MessageSquare,
  Users,
  Smartphone,
  Send,
  RefreshCw,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CheckCheck,
} from 'lucide-react';

export default function UserAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const [data, setData] = useState<UserWorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        range,
        startDate: range === 'custom' && customStart ? customStart : undefined,
        endDate: range === 'custom' && customEnd ? customEnd : undefined,
        instanceId: selectedInstanceId !== 'all' ? selectedInstanceId : undefined,
      };

      const res = await analyticsApi.getUserAnalytics(params);
      setData(res);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load workspace analytics';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [range, selectedInstanceId, customStart, customEnd]);

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

  const deliveryRate =
    data?.messages.outgoing && data.messages.outgoing > 0
      ? Math.min(100, Math.round((data.messages.delivered / data.messages.outgoing) * 100))
      : 0;

  const readRate =
    data?.messages.delivered && data.messages.delivered > 0
      ? Math.min(100, Math.round((data.messages.read / data.messages.delivered) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <DashboardPageHeader
          title="Workspace Analytics"
          description="Real-time operational messaging metrics, instance throughput, and campaign deliverability."
          breadcrumbs={[{ title: 'Analytics' }]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {/* WhatsApp Instance Filter */}
          <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2.5 py-1 text-xs">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-foreground focus:outline-none cursor-pointer pr-1"
              aria-label="Filter by WhatsApp connection"
            >
              <option value="all">All Connections</option>
              {data?.availableInstances
                ?.filter((inst) => inst.id !== 'all')
                .map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.title} {inst.number && inst.number !== 'Unpaired' ? `(${inst.number})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs overflow-x-auto max-w-full no-scrollbar shrink-0">
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
                  if (item.key === 'custom') {
                    setShowCustomPicker(true);
                  } else {
                    setShowCustomPicker(false);
                  }
                }}
                className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition-colors touch-manipulation ${
                  range === item.key
                    ? 'bg-background text-foreground shadow-2xs'
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
            onClick={() => fetchAnalytics()}
            disabled={loading}
            className="h-8 gap-1.5 text-xs shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar */}
      {(showCustomPicker || range === 'custom') && (
        <Card className="border border-border/70 bg-muted/20 p-3 shadow-2xs">
          <form onSubmit={handleApplyCustomDates} className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Custom Date Window:</span>
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
              Apply Window
            </Button>
          </form>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Analytics</AlertTitle>
          <AlertDescription className="mt-1 flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalytics()}
              className="h-7 text-xs ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Messages Outbound */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-semibold text-muted-foreground">Messages Sent</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="text-2xl font-bold font-mono tracking-tight">
              {loading ? <Skeleton className="h-8 w-24" /> : data?.messages.outgoing.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCheck className="h-3 w-3" />
                <span>{data?.messages.delivered.toLocaleString() || 0} deliv</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <span>{data?.messages.read.toLocaleString() || 0} read</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Messages Inbound */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-semibold text-muted-foreground">Messages Received</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="text-2xl font-bold font-mono tracking-tight">
              {loading ? <Skeleton className="h-8 w-24" /> : data?.messages.incoming.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {Boolean(data?.messages.failed) ? (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <XCircle className="h-3 w-3" />
                  <span>{data?.messages.failed} failed</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>0 failures</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Audience / Contacts */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-semibold text-muted-foreground">Workspace Audience</span>
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="text-2xl font-bold font-mono tracking-tight">
              {loading ? <Skeleton className="h-8 w-24" /> : data?.contacts.total.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                +{data?.contacts.newInPeriod.toLocaleString() || 0}
              </span>{' '}
              new contacts in period
            </div>
          </CardContent>
        </Card>

        {/* Conversations Count */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs font-semibold text-muted-foreground">Conversations</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="text-2xl font-bold font-mono tracking-tight">
              {loading ? <Skeleton className="h-8 w-24" /> : data?.conversations.total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{data?.conversations.activeInPeriod || 0} active in period</span>
              {Boolean(data?.conversations.totalUnread) && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/20 bg-amber-500/10 px-1 py-0">
                  {data?.conversations.totalUnread} unread
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Message Volume Chart + Plan Usage Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Throughput Chart (2 Columns) */}
        <Card className="shadow-2xs border lg:col-span-2">
          <CardHeader className="p-5 pb-2 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>Message Throughput Over Time</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Daily incoming vs outgoing messages stored in the database.
                </CardDescription>
              </div>

              {data?.selectedInstance && (
                <Badge variant="secondary" className="text-[11px] self-start sm:self-auto font-normal">
                  Scoped: {data.selectedInstance.title}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            {loading ? (
              <div className="h-60 flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-xl" />
              </div>
            ) : !data?.messages.timeSeries || data.messages.timeSeries.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <span className="text-xs font-medium">No messaging activity recorded for this period.</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Try selecting a wider date range or &ldquo;All Connections&rdquo;.
                </span>
              </div>
            ) : (
              <TimeSeriesChart
                data={data.messages.timeSeries}
                height={260}
                series={[
                  { key: 'incoming', label: 'Incoming Messages', color: '#10b981' },
                  { key: 'outgoing', label: 'Outgoing Messages', color: '#3b82f6' },
                  { key: 'failed', label: 'Failed Messages', color: '#ef4444' },
                ]}
                emptyMessage="No messaging activity recorded for this period."
              />
            )}
          </CardContent>
        </Card>

        {/* Plan & Usage Summary (1 Column) */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-5 pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Plan Quota & Consumption</span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Live database utilization vs subscription entitlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Tier:</span>
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {data?.usage.planTitle || 'Free Tier'}
                  </Badge>
                </div>

                {/* Contacts Gauge */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Contact Audience</span>
                    <span className="font-mono text-muted-foreground">
                      {data?.usage.contacts.used.toLocaleString()} /{' '}
                      {data?.usage.contacts.limit ? data.usage.contacts.limit.toLocaleString() : '∞'}
                    </span>
                  </div>
                  <Progress
                    value={
                      data?.usage.contacts.limit
                        ? Math.min(100, Math.round((data.usage.contacts.used / data.usage.contacts.limit) * 100))
                        : 0
                    }
                    className="h-1.5"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{data?.usage.contacts.remaining.toLocaleString()} slots available</span>
                    <span>
                      {data?.usage.contacts.limit
                        ? `${Math.min(100, Math.round((data.usage.contacts.used / data.usage.contacts.limit) * 100))}%`
                        : 'Unlimited'}
                    </span>
                  </div>
                </div>

                {/* WhatsApp Instances Gauge */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">WhatsApp Accounts</span>
                    <span className="font-mono text-muted-foreground">
                      {data?.usage.qrAccounts.used} / {data?.usage.qrAccounts.limit || '∞'}
                    </span>
                  </div>
                  <Progress
                    value={
                      data?.usage.qrAccounts.limit
                        ? Math.min(100, Math.round((data.usage.qrAccounts.used / data.usage.qrAccounts.limit) * 100))
                        : 0
                    }
                    className="h-1.5"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{data?.whatsapp.active || 0} connected active</span>
                    <span>
                      {data?.usage.qrAccounts.limit
                        ? `${Math.min(100, Math.round((data.usage.qrAccounts.used / data.usage.qrAccounts.limit) * 100))}%`
                        : 'Unlimited'}
                    </span>
                  </div>
                </div>

                {/* Delivery Velocity stats */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Deliverability Rate:</span>
                    <span className="font-semibold text-emerald-600 font-mono">{deliveryRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Recipient Read Rate:</span>
                    <span className="font-semibold text-blue-600 font-mono">{readRate}%</span>
                  </div>
                </div>

                {data?.usage.planExpire && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>Active until: {new Date(data.usage.planExpire).toLocaleDateString()}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Campaign Deliverability + Contacts by Phonebook */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Deliverability Table (2 Columns) */}
        <Card className="shadow-2xs border lg:col-span-2">
          <CardHeader className="p-5 pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <span>Broadcast Campaign Performance</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Aggregate dispatch, delivery, and read counts from beta_campaign records.
                </CardDescription>
              </div>

              {Boolean(data?.campaigns.total) && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald-600 font-medium">
                    {data?.campaigns.sent.toLocaleString()} sent
                  </span>
                  <span className="text-muted-foreground">
                    {data?.campaigns.delivered.toLocaleString()} delivered
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !data?.campaigns.recent || data.campaigns.recent.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                <span>No broadcast campaigns found for this period.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground text-left">
                      <th className="py-2.5 px-4 font-semibold">Campaign</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Audience</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Sent</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Delivered</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Read</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.campaigns.recent.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{c.title}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-semibold ${
                              c.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : c.status === 'RUNNING'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          {c.total_contacts.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                          {c.sent_count.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          {c.delivered_count.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-600">
                          {c.read_count.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts by Phonebook (1 Column) */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-5 pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Contacts by Phonebook</span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Audience segmentation across phonebooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : !data?.contacts.byPhonebook || data.contacts.byPhonebook.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No phonebook contacts recorded.
              </div>
            ) : (
              data.contacts.byPhonebook.map((p, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[160px]">
                      {p.phonebook}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {p.count.toLocaleString()} contacts
                    </span>
                  </div>
                  <Progress
                    value={
                      data.contacts.total > 0
                        ? Math.round((p.count / data.contacts.total) * 100)
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
