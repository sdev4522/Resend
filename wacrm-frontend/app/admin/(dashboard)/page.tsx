'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsApi } from '@/lib/api/analytics';
import { adminApi } from '@/lib/api/admin';
import { AdminPlatformAnalytics } from '@/types/analytics';
import { AdminUserListItem } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TimeSeriesChart } from '@/components/analytics/time-series-chart';
import {
  Users,
  CreditCard,
  Smartphone,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  Building2,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminPlatformAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resAnalytics, resUsers] = await Promise.all([
        analyticsApi.getAdminAnalytics('30d'),
        adminApi.getUsers(),
      ]);

      if (resAnalytics) {
        setData(resAnalytics);
      } else {
        setError('Failed to load administrative analytics data.');
      }

      if (resUsers && resUsers.success && Array.isArray(resUsers.data)) {
        setUsers(resUsers.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with administrative APIs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin System Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time platform metrics, active subscriptions, and user health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/analytics">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              Detailed Analytics
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchOverviewData} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading System Overview</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchOverviewData} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">
                ${(data?.revenue.totalRevenue || 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {data?.revenue.successfulOrders || 0} paid of {data?.revenue.totalOrders || 0} total orders
            </p>
          </div>
        </Card>

        <Card className="shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tenants
            </span>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">
                {(data?.users.total || 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span className="text-emerald-600 font-medium">{data?.users.active || 0} active</span>
              <span>•</span>
              <span className="text-red-500 font-medium">{data?.users.blocked || 0} blocked</span>
            </p>
          </div>
        </Card>

        <Card className="shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              WhatsApp Sessions
            </span>
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">
                {data?.whatsapp.active || 0} / {data?.whatsapp.total || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Active connected WhatsApp numbers
            </p>
          </div>
        </Card>

        <Card className="shadow-xs p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform Messages
            </span>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold font-mono text-foreground">
                {(data?.throughput.messagesInPeriod || 0).toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Network activity in last 30 days
            </p>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tenant Sign-Up Velocity (Last 30 Days)
            </CardTitle>
            <CardDescription className="text-xs">
              Daily customer registrations recorded in the database
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.users.growthTimeSeries?.length ? (
              <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                No user registrations recorded in the selected period.
              </div>
            ) : (
              <TimeSeriesChart
                data={data.users.growthTimeSeries}
                series={[{ key: 'count', label: 'New Tenants', color: '#3b82f6' }]}
                height={220}
              />
            )}
          </CardContent>
        </Card>

        {/* Revenue Velocity */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              Platform Revenue Velocity (Last 30 Days)
            </CardTitle>
            <CardDescription className="text-xs">
              Daily paid subscription orders collected
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !data?.revenue.timeSeries?.length ? (
              <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
                No paid orders recorded in the selected period.
              </div>
            ) : (
              <TimeSeriesChart
                data={data.revenue.timeSeries}
                series={[{ key: 'revenue', label: 'Revenue ($)', color: '#10b981' }]}
                valueFormatter={(v) => `$${v.toLocaleString()}`}
                height={220}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution and Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Plan Distribution */}
        <Card className="shadow-xs lg:col-span-1">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Subscription Tiers</CardTitle>
            <CardDescription className="text-xs">Distribution of users across plans</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : !data?.users.planDistribution?.length ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No plans assigned yet.</div>
            ) : (
              data.users.planDistribution.map((item, idx: number) => {
                const total = data?.users.total || 1;
                const percentage = Math.round((item.count / total) * 100);

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.planTitle}</span>
                      <span className="text-muted-foreground font-mono">
                        {item.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Registered Users */}
        <Card className="shadow-xs lg:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Registered Accounts</CardTitle>
              <CardDescription className="text-xs">Latest customer tenants to join the platform</CardDescription>
            </div>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No users found.</div>
            ) : (
              <div className="divide-y divide-border">
                {users.slice(0, 5).map((u) => {
                  const isBlocked = u.is_blocked === 1 || u.is_blocked === true;

                  return (
                    <div key={u.uid} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {(u.name || 'U').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/admin/users/${u.uid}`}
                            className="text-sm font-semibold text-foreground hover:underline hover:text-primary transition-colors"
                          >
                            {u.name || 'Unnamed User'}
                          </Link>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isBlocked ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Blocked
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Active
                          </Badge>
                        )}
                        <Link href={`/admin/users/${u.uid}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            Inspect
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick God-Mode Navigation & Health */}
        <Card className="shadow-xs lg:col-span-3">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              Platform Command Center Quick Actions
            </CardTitle>
            <CardDescription className="text-xs">
              Direct access to all platform infrastructure and management domains
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <Link href="/admin/workspaces" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Workspaces</span>
              <span className="text-[10px] text-muted-foreground">Manage Tenants</span>
            </Link>

            <Link href="/admin/whatsapp" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-violet-500/10 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Smartphone className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">WhatsApp Fleet</span>
              <span className="text-[10px] text-muted-foreground">QR &amp; Meta Nodes</span>
            </Link>

            <Link href="/admin/subscriptions" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Subscriptions</span>
              <span className="text-[10px] text-muted-foreground">Active Tiers</span>
            </Link>

            <Link href="/admin/usage" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Usage &amp; Limits</span>
              <span className="text-[10px] text-muted-foreground">Quota Monitor</span>
            </Link>

            <Link href="/admin/payments" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-pink-500/10 text-pink-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Payment Logs</span>
              <span className="text-[10px] text-muted-foreground">Razorpay Audit</span>
            </Link>

            <Link href="/admin/audit" className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-center text-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-slate-500/10 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Audit Logs</span>
              <span className="text-[10px] text-muted-foreground">Admin Activity</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

