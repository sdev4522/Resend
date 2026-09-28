'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { AdminUsageSummaryItem } from '@/types/admin';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Gauge,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Bot,
  Smartphone,
} from 'lucide-react';

export default function AdminUsageLimitsPage() {
  const [usageItems, setUsageItems] = useState<AdminUsageSummaryItem[]>([]);
  const [summary, setSummary] = useState({
    totalInspected: 0,
    nearLimit: 0,
    limitReached: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUsageSummary();
      if (res && res.success) {
        setUsageItems(res.data);
        if (res.summary) setSummary(res.summary);
      } else {
        setError('Failed to load usage quotas.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with entitlement subsystem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const filtered = usageItems.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.planTitle?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usage &amp; Limits Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform-wide visibility into contact database quotas, WhatsApp account capacity, and chatbot activation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsage}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link href="/admin/plans">
            <Button size="sm" className="gap-1.5 text-xs h-8">
              Adjust Plan Quotas
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Inspected Workspaces</span>
            <Gauge className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {summary.totalInspected}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active customer tenants</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Near Quota Limit (&gt;80%)</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {summary.nearLimit}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Approaching upgrade threshold</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Quota Exceeded / At Limit</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {summary.limitReached}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">At 100% capacity</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border">
        <CardHeader className="p-4 pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, email, plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <span className="text-xs text-muted-foreground">
            {filtered.length} workspaces analyzed
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Usage Monitor Error</AlertTitle>
                <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No tenants found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Customer Workspace</TableHead>
                    <TableHead>Current Plan</TableHead>
                    <TableHead>Contact Storage Quota</TableHead>
                    <TableHead>WhatsApp Instances</TableHead>
                    <TableHead>Chatbot Status</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filtered.map((item) => (
                    <TableRow key={item.uid} className="hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/users/${item.uid}`}
                            className="font-semibold text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1"
                          >
                            {item.name} <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                          <span className="text-[11px] text-muted-foreground">{item.email}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-semibold text-[11px]">
                          {item.planTitle}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="space-y-1 w-36">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-mono">{item.contacts.used} / {item.contacts.limit}</span>
                            <span className="text-muted-foreground">{item.contacts.percent}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.contacts.percent >= 100
                                  ? 'bg-red-500'
                                  : item.contacts.percent >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                              }`}
                              style={{ width: `${item.contacts.percent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{item.instances.used} / {item.instances.limit}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        {item.chatbots.allowed ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <Bot className="h-3.5 w-3.5" />
                            <span>{item.chatbots.activeCount} active bots</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Disabled in tier</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        {item.usageRisk === 'LIMIT_REACHED' ? (
                          <Badge variant="destructive" className="text-[10px]">
                            At Limit
                          </Badge>
                        ) : item.usageRisk === 'NEAR_LIMIT' ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                            Near Limit
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Normal
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <Link href={`/admin/users/${item.uid}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
                            Inspect <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
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
  );
}
