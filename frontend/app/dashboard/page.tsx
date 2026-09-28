'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import {
  dashboardApi,
  DashboardData,
  QrInstance,
  MetaApiKeys,
} from '@/lib/api/dashboard';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { getPlanTitle } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  MessageSquare,
  Bot,
  UserCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  RefreshCw,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [instances, setInstances] = useState<QrInstance[]>([]);
  const [metaKeys, setMetaKeys] = useState<MetaApiKeys | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashRes, qrRes, metaRes] = await Promise.allSettled([
        dashboardApi.getDashboard(),
        dashboardApi.getQrInstances(),
        dashboardApi.getMetaKeys(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.success) {
        setData(dashRes.value.data);
      } else if (dashRes.status === 'rejected') {
        throw new Error(dashRes.reason?.message || 'Failed to load dashboard metrics');
      }

      if (qrRes.status === 'fulfilled' && qrRes.value.success) {
        setInstances(qrRes.value.data || []);
      }

      if (metaRes.status === 'fulfilled' && metaRes.value.success) {
        setMetaKeys(metaRes.value.data || null);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Determine WhatsApp connection status from real backend data
  const activeQr = instances.find((i) => i.status === 'ACTIVE');
  const hasMeta = Boolean(metaKeys?.phone_number_id && metaKeys?.token);
  const isConnected = Boolean(activeQr || hasMeta || user?.wa_connected);
  const connectionType = activeQr
    ? `Baileys QR (${activeQr.phone || activeQr.name})`
    : hasMeta
    ? 'Meta Cloud API'
    : user?.wa_connected
    ? `Cloud API (${user.wa_phone || 'Active'})`
    : null;

  return (
    <div className="space-y-8">
      {/* Reusable Header */}
      <DashboardPageHeader
        title={`Welcome back, ${user?.name || 'Partner'}`}
        description="Real-time overview of your WhatsApp customer engagement, conversations, and connected services."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
            className="rounded-full gap-1.5 cursor-pointer text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error}. Some metrics may be temporarily unavailable.{' '}
            <button
              type="button"
              onClick={fetchDashboard}
              className="underline font-semibold ml-1 cursor-pointer"
            >
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* WhatsApp Connection Card */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              WhatsApp Connection Status
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time messaging fleet connectivity and active number status.
            </CardDescription>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : isConnected ? (
            <Badge className="bg-primary text-primary-foreground rounded-full px-3 py-0.5 text-xs font-medium gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs font-medium">
              Disconnected
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
          ) : isConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Channel Active: <span className="font-semibold">{connectionType}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Ready to receive incoming customer messages and send automated broadcasts.
                </p>
              </div>
              <Button
                render={<Link href="/dashboard/integrations" />}
                variant="outline"
                size="sm"
                className="rounded-full text-xs shrink-0"
              >
                Manage Connections
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  No WhatsApp number currently active
                </p>
                <p className="text-xs text-muted-foreground">
                  Connect your Meta WhatsApp Cloud API credentials or scan a QR instance to begin messaging.
                </p>
              </div>
              <Button
                render={<Link href="/dashboard/integrations" />}
                size="sm"
                className="rounded-full text-xs shrink-0"
              >
                Connect WhatsApp <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real Statistics Grid (Zero Mock Data) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Chats */}
        <Card className="shadow-xs border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Unread / Active Chats
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {data?.stats?.activeChats ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Unread inquiries awaiting agent response
            </p>
          </CardContent>
        </Card>

        {/* Total Contacts */}
        <Card className="shadow-xs border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Contacts
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-foreground">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {data?.user?.contact ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Stored customer contacts in phonebooks
            </p>
          </CardContent>
        </Card>

        {/* Team Agents */}
        <Card className="shadow-xs border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Team Agents
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-foreground">
              <UserCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {data?.stats?.agents ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Active workspace team members
            </p>
          </CardContent>
        </Card>

        {/* Active Chatbots */}
        <Card className="shadow-xs border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Automations
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-foreground">
              <Bot className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold tracking-tight">
                {data?.activeChatbots?.length ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Automated chatbot rules deployed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Lower Section: Usage Overview & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Usage Overview Foundation */}
        <Card className="lg:col-span-2 shadow-xs border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Workspace Usage & Limits
                </CardTitle>
                <CardDescription className="text-xs">
                  Current plan limits and capacity utilization.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {getPlanTitle(data?.user?.plan)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                {/* Contacts usage */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Contacts Stored</span>
                    <span className="text-muted-foreground">
                      {data?.user?.contact ?? 0} / {data?.user?.plan?.contact_limit || 'Unlimited'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          data?.user?.plan?.contact_limit
                            ? ((data?.user?.contact || 0) / data.user.plan.contact_limit) * 100
                            : 10
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Team agent seats */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Team Agent Seats</span>
                    <span className="text-muted-foreground">
                      {data?.stats?.agents ?? 0} / {data?.user?.plan?.agent_limit || '5'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          data?.user?.plan?.agent_limit
                            ? ((data?.stats?.agents || 0) / data.user.plan.agent_limit) * 100
                            : 20
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Plan validity notice */}
                <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Plan Expiry:{' '}
                    <strong className="text-foreground font-semibold">
                      {data?.user?.plan_expire
                        ? new Date(data.user.plan_expire).toLocaleDateString()
                        : 'Active'}
                    </strong>
                  </span>
                  <Link
                    href="/dashboard/billing"
                    className="text-primary hover:underline font-semibold"
                  >
                    View Plan Details &rarr;
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions (Functional Only) */}
        <Card className="shadow-xs border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-xs">
              Frequent operations for your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button
              render={<Link href="/dashboard/inbox" />}
              variant="outline"
              className="w-full justify-start text-xs h-9 rounded-xl font-medium cursor-pointer"
            >
              <MessageSquare className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Open WhatsApp Inbox</span>
            </Button>

            <Button
              render={<Link href="/dashboard/team" />}
              variant="outline"
              className="w-full justify-start text-xs h-9 rounded-xl font-medium cursor-pointer"
            >
              <Users className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Manage Team Members</span>
            </Button>

            <Button
              render={<Link href="/dashboard/integrations" />}
              variant="outline"
              className="w-full justify-start text-xs h-9 rounded-xl font-medium cursor-pointer"
            >
              <Smartphone className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>WhatsApp Settings & QR</span>
            </Button>

            <Button
              render={<Link href="/dashboard/settings" />}
              variant="outline"
              className="w-full justify-start text-xs h-9 rounded-xl font-medium cursor-pointer"
            >
              <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Workspace Preferences</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Message Traffic */}
      <Card className="shadow-xs border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent Message Activity
          </CardTitle>
          <CardDescription className="text-xs">
            7-day overview of incoming and outgoing customer messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : data?.performanceData && data.performanceData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b text-muted-foreground uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Incoming Messages</th>
                    <th className="py-2.5 px-3">Outgoing Messages</th>
                    <th className="py-2.5 px-3">Total Traffic</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.performanceData.map((day) => (
                    <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{day.date}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{day.incoming}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{day.outgoing}</td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {day.incoming + day.outgoing}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">No Recent Message Activity</span>
              <p className="text-xs text-muted-foreground max-w-sm">
                Incoming and outgoing messages from connected WhatsApp channels will appear here automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
