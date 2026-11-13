'use client';

import { ClaimTrialCard, usePlanStatus } from '@/components/dashboard/plan-status';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { dashboardApi, DashboardData, QrInstance, MetaApiKeys } from '@/lib/api/dashboard';
import { GettingStarted } from '@/components/dashboard/getting-started';
import { MessageChart } from '@/components/dashboard/message-chart';
import { getPlanTitle, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  MessageSquare,
  Bot,
  UserCheck,
  Smartphone,
  AlertCircle,
  RefreshCw,
  Activity,
  Send,
  Plug,
  Settings,
  ChevronRight,
  Zap,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

/* ----------------------------- helpers ----------------------------- */

/** plan arrives as a JSON string from the backend; limits inside it are strings too */
function parsePlan(plan: unknown): Record<string, unknown> | null {
  if (!plan) return null;
  if (typeof plan === 'object') return plan as Record<string, unknown>;
  if (typeof plan === 'string') {
    try {
      const p = JSON.parse(plan);
      return p && typeof p === 'object' ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toLimit(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** plan_expire is stored as epoch milliseconds in a string */
function parseExpiry(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ----------------------------- pieces ----------------------------- */

const TINTS = {
  mint: 'bg-[#dff7ee] text-[#00785f] dark:bg-[#0f3a2f] dark:text-[#5fe0bd]',
  lilac: 'bg-[#ece9ff] text-[#5b4bd6] dark:bg-[#26224a] dark:text-[#b8afff]',
  sky: 'bg-[#e0f0ff] text-[#1f6fb8] dark:bg-[#132c46] dark:text-[#8cc8ff]',
  peach: 'bg-[#ffeedd] text-[#b05f12] dark:bg-[#3d2716] dark:text-[#ffc48a]',
} as const;

function StatCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tint,
  loading,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tint: keyof typeof TINTS;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_32px_-14px_rgba(15,23,42,0.25)]"
    >
      <div className="flex items-start justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', TINTS[tint])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <ChevronRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-16" />
      ) : (
        <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{value.toLocaleString()}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const near = limit !== null && pct >= 80;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{used.toLocaleString()}</span>
          {limit ? ` of ${limit.toLocaleString()}` : ' (no limit on your plan)'}
        </span>
      </div>
      {limit && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={used} aria-valuemax={limit} aria-label={label}>
          <div
            className={cn('h-full rounded-full transition-[width] duration-700', near ? 'bg-warning' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

const ACTIONS: { href: string; label: string; hint: string; icon: LucideIcon; tint: keyof typeof TINTS }[] = [
  { href: '/dashboard/inbox', label: 'Open inbox', hint: 'Reply to customers', icon: MessageSquare, tint: 'mint' },
  { href: '/dashboard/campaigns', label: 'New campaign', hint: 'Broadcast a template', icon: Send, tint: 'lilac' },
  { href: '/dashboard/team', label: 'Invite teammate', hint: 'Share the inbox', icon: UserCheck, tint: 'sky' },
  { href: '/dashboard/settings', label: 'Settings', hint: 'Workspace preferences', icon: Settings, tint: 'peach' },
];

/* ----------------------------- page ----------------------------- */

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [instances, setInstances] = useState<QrInstance[]>([]);
  const [metaKeys, setMetaKeys] = useState<MetaApiKeys | null>(null);
  const [now] = useState(() => Date.now());

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

  // Reload the summary right after the free trial is claimed (plan chip, expiry)
  const { state: planState } = usePlanStatus();
  const prevPlanState = React.useRef(planState);
  useEffect(() => {
    if (prevPlanState.current === 'trial_available' && planState === 'active') fetchDashboard();
    prevPlanState.current = planState;
  }, [planState, fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // WhatsApp connection status from real backend data
  const activeQr = instances.find((i) => i.status === 'ACTIVE');
  const hasMeta = Boolean(metaKeys?.phone_number_id && metaKeys?.token);
  const isConnected = Boolean(activeQr || hasMeta || user?.wa_connected);
  const connectionType = activeQr
    ? `QR number ${activeQr.phone || activeQr.name}`
    : hasMeta
      ? 'Meta Cloud API'
      : user?.wa_connected
        ? `Cloud API ${user.wa_phone || ''}`.trim()
        : null;

  const plan = parsePlan(data?.user?.plan);
  const expiry = parseExpiry(data?.user?.plan_expire);
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - now) / 86_400_000) : null;
  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const days = data?.performanceData || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Welcome + connection */}
      <section className="relative isolate overflow-hidden rounded-3xl border bg-card p-6 shadow-xs sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 -top-24 h-72 w-96 rounded-full bg-[#b6f2d6]/70 blur-3xl dark:bg-[#0f5a45]/50" />
          <div className="absolute -right-16 -top-10 h-72 w-96 rounded-full bg-[#d6d0ff]/70 blur-3xl dark:bg-[#3b3477]/50" />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground" suppressHydrationWarning>
              {new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" suppressHydrationWarning>
              {greeting(now)}, {firstName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 font-medium backdrop-blur">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {getPlanTitle(data?.user?.plan)}
              </span>
              {daysLeft !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 backdrop-blur',
                    daysLeft <= 3 ? 'border-warning/40 text-warning' : 'text-muted-foreground',
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {daysLeft > 0 ? `${daysLeft} days left` : 'Plan expired'}
                </span>
              )}
            </div>
          </div>

          {/* Connection state: the one thing a new user must do */}
          <div className="w-full rounded-2xl border bg-background/80 p-4 backdrop-blur lg:w-[400px]">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-full rounded-full" />
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff7ee] text-[#00785f] dark:bg-[#0f3a2f] dark:text-[#5fe0bd]">
                  <Smartphone className="h-[18px] w-[18px]" />
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">WhatsApp connected</p>
                  <p className="truncate text-xs text-muted-foreground">{connectionType}</p>
                </div>
                <Button render={<Link href="/dashboard/integrations" />} variant="outline" size="sm" className="rounded-full">
                  Manage
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning dark:bg-warning/15">
                    <Smartphone className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">WhatsApp not connected</p>
                    <p className="text-xs text-muted-foreground">Scan a QR code or add the Cloud API. Takes about 5 minutes.</p>
                  </div>
                </div>
                <Button render={<Link href="/dashboard/integrations" />} className="mt-3 w-full rounded-full">
                  <Plug className="mr-1.5 h-4 w-4" /> Connect WhatsApp
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Unclaimed free trial: the first thing a new workspace should do */}
      <ClaimTrialCard />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error}. Some numbers may be missing.{' '}
            <button type="button" onClick={fetchDashboard} className="ml-1 cursor-pointer font-semibold underline">
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && (
        <GettingStarted
          uid={user?.uid}
          whatsappConnected={isConnected}
          agentCount={Number(data?.stats?.agents || 0)}
          activeChatbotCount={data?.activeChatbots?.length || 0}
        />
      )}

      {/* Stats: each card opens the page it summarises */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard href="/dashboard/inbox" label="Unread chats" value={Number(data?.stats?.activeChats ?? 0)} hint="Waiting for a reply" icon={MessageSquare} tint="mint" loading={loading} />
        <StatCard href="/dashboard/contacts" label="Contacts" value={Number(data?.user?.contact ?? 0)} hint="Saved in your phonebooks" icon={Users} tint="lilac" loading={loading} />
        <StatCard href="/dashboard/team" label="Team agents" value={Number(data?.stats?.agents ?? 0)} hint="Can reply from the inbox" icon={UserCheck} tint="sky" loading={loading} />
        <StatCard href="/dashboard/automation" label="Active chatbots" value={data?.activeChatbots?.length ?? 0} hint="Replying automatically" icon={Bot} tint="peach" loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages chart */}
        <section className="rounded-2xl border bg-card p-6 shadow-xs lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Messages, last 7 days</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Across every connected number</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchDashboard} disabled={loading} className="rounded-full text-muted-foreground">
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
          <div className="mt-5">
            {loading ? (
              <Skeleton className="h-56 w-full rounded-xl" />
            ) : days.length > 0 ? (
              <MessageChart days={days} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Activity className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Connect a WhatsApp number and messages will be counted here each day.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right column: quick actions + usage */}
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group rounded-xl border bg-background p-3 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_24px_-14px_rgba(15,23,42,0.3)]"
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110', TINTS[a.tint])}>
                    <a.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-2.5 text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.hint}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Plan usage</h2>
              <Link href="/dashboard/billing" className="text-xs font-semibold text-primary hover:underline">
                View plan
              </Link>
            </div>
            {loading ? (
              <div className="mt-4 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                <UsageRow label="Contacts" used={Number(data?.user?.contact ?? 0)} limit={toLimit(plan?.contact_limit)} />
                <UsageRow label="QR numbers" used={instances.length} limit={toLimit(plan?.qr_account)} />
                <p className="border-t pt-4 text-xs text-muted-foreground">
                  {expiry
                    ? `Renews or ends on ${expiry.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'No end date on this plan'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
