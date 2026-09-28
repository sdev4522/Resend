'use client';

import React from 'react';
import { DeveloperLimits, DeveloperStats } from '@/types/developer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ShieldCheck, Gauge, CheckCircle2, AlertCircle } from 'lucide-react';

interface LimitsCardProps {
  limits: DeveloperLimits | null;
  stats: DeveloperStats | null;
}

export function LimitsCard({ limits, stats }: LimitsCardProps) {
  if (!limits) {
    return null;
  }

  const monthlyQuota = limits.monthly_quota || 100000;
  const currentMessagesUsed = stats ? (stats.messages.accepted || 0) : 0;
  const quotaPercentage = Math.min(100, Math.round((currentMessagesUsed / monthlyQuota) * 100));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Rate Limits & Quota</h3>
        <p className="text-xs text-muted-foreground">
          Real-time rate limits and plan quotas enforced server-side on your developer API traffic.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Request Rate Limit */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Key Rate Limit</span>
              <Gauge className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {limits.requests_per_minute}{' '}
              <span className="text-xs font-normal text-muted-foreground">req / min</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Maximum throughput per API key before receiving HTTP 429.
            </p>
          </CardContent>
        </Card>

        {/* Message Rate Limit */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Connection Limit</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {limits.messages_per_minute}{' '}
              <span className="text-xs font-normal text-muted-foreground">msg / min</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Protects connected WhatsApp numbers against spam bans.
            </p>
          </CardContent>
        </Card>

        {/* Workspace Limit */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Workspace Limit</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {limits.workspace_requests_per_minute}{' '}
              <span className="text-xs font-normal text-muted-foreground">req / min</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Shared maximum volume across all generated API keys.
            </p>
          </CardContent>
        </Card>

        {/* Plan API Entitlement */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">API Access</span>
              {limits.api_allowed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <div className="mt-1">
              <Badge
                variant="outline"
                className={
                  limits.api_allowed
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs'
                }
              >
                {limits.api_allowed ? 'Active Entitlement' : 'Plan Upgrade Required'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Authoritative entitlement from your subscription tier.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Quota Card */}
      <Card className="border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-sm font-semibold">Monthly Messages Quota</h4>
            <p className="text-xs text-muted-foreground">
              Volume of accepted WhatsApp messages across all API requests this calendar month.
            </p>
          </div>
          <div className="text-sm font-mono font-medium">
            <span className="font-bold text-foreground">{currentMessagesUsed.toLocaleString()}</span>
            <span className="text-muted-foreground"> / {monthlyQuota.toLocaleString()} msgs</span>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden mt-3">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              quotaPercentage > 85 ? 'bg-rose-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.max(2, quotaPercentage)}%` }}
          />
        </div>
      </Card>
    </div>
  );
}
