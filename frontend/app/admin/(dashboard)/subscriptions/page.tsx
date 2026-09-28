'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { AdminSubscriptionItem } from '@/types/admin';
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
  CreditCard,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    expired: 0,
    suspended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getSubscriptions();
      if (res && res.success) {
        setSubscriptions(res.data);
        if (res.summary) setSummary(res.summary);
      } else {
        setError('Failed to load subscriptions.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with billing subsystem.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const filtered = subscriptions.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.userName?.toLowerCase().includes(q) ||
      s.userEmail?.toLowerCase().includes(q) ||
      s.planTitle?.toLowerCase().includes(q) ||
      s.subscriptionId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">SaaS Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time subscriber state, billing cycles, Razorpay autopay mandates, and entitlement expiry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSubscriptions}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link href="/admin/plans">
            <Button size="sm" className="gap-1.5 text-xs h-8">
              <span>Manage Plans</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Subscribed</span>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {summary.total}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Assigned tenant plans</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Subscriptions</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {summary.active}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Current &amp; valid</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Expired Tiers</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {summary.expired}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Past renewal date</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Suspended</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {summary.suspended}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Account blocked</p>
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
            {filtered.length} subscribers found
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Billing Error</AlertTitle>
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
              No subscription records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Customer Tenant</TableHead>
                    <TableHead>Subscribed Plan</TableHead>
                    <TableHead>Billing Mode</TableHead>
                    <TableHead>Last Collected</TableHead>
                    <TableHead>Plan Expiry / Renewal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filtered.map((sub) => {
                    const isActive = sub.status === 'ACTIVE';

                    return (
                      <TableRow key={sub.uid} className="hover:bg-muted/30">
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/users/${sub.uid}`}
                              className="font-semibold text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {sub.userName} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                            <span className="text-[11px] text-muted-foreground">{sub.userEmail}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="font-semibold text-[11px]">
                              {sub.planTitle}
                            </Badge>
                            {sub.isTrial && (
                              <Badge variant="secondary" className="text-[10px]">Trial</Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3 font-mono text-[11px]">
                          {sub.paymentMode}
                        </TableCell>

                        <TableCell className="py-3 font-mono font-medium">
                          {sub.price ? `$${Number(sub.price).toFixed(2)}` : 'Free'}
                        </TableCell>

                        <TableCell className="py-3 text-[11px]">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{sub.planExpire ? new Date(sub.planExpire).toLocaleDateString() : 'Lifetime / No Expiry'}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          {isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              Active
                            </Badge>
                          ) : sub.status === 'EXPIRED' ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Suspended
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <Link href={`/admin/users/${sub.uid}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
                              Inspect <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
