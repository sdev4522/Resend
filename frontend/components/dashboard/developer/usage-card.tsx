'use client';

import React from 'react';
import { DeveloperStats } from '@/types/developer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCheck, AlertTriangle, Activity } from 'lucide-react';

interface UsageCardProps {
  stats: DeveloperStats | null;
}

export function UsageCard({ stats }: UsageCardProps) {
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">API Usage & Delivery</h3>
        <p className="text-xs text-muted-foreground">
          Authoritative metrics for current period ({stats.period}).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total API Requests */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">API Invocations</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {stats.api_requests.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">Total HTTP calls received by v1 endpoints</p>
          </CardContent>
        </Card>

        {/* Messages Accepted */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Messages Accepted</span>
              <Send className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {(stats.messages?.accepted || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">Dispatched into WhatsApp queue</p>
          </CardContent>
        </Card>

        {/* Delivered / Sent */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Delivered / Sent</span>
              <CheckCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {((stats.messages?.delivered || stats.messages?.sent) || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">Confirmed by WhatsApp network</p>
          </CardContent>
        </Card>

        {/* Failed Messages */}
        <Card className="border bg-card shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Failed Deliveries</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {(stats.messages?.failed || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">Invalid numbers or connection drops</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
