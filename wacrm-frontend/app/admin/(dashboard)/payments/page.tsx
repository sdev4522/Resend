'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  CreditCard,
  RefreshCw,
  Zap,
  TrendingUp,
  Receipt,
  Settings,
} from 'lucide-react';

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPaymentOrders();
      if (res && res.orders) {
        setOrders(res.orders);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load payment orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const paidOrders = orders.filter((o) => o.status?.toLowerCase() === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  const autopayCount = orders.filter((o) => o.isAutopay).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment Logs &amp; Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit real-time subscription transactions, Razorpay checkout orders, and Autopay billing logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/admin/settings">
            <Button size="sm" className="gap-1.5 text-xs h-8 shadow-2xs font-semibold">
              <Settings className="h-3.5 w-3.5" />
              <span>Gateway Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-2xs rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Verified Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1 font-mono">
            ${totalRevenue.toFixed(2)}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Across {paidOrders.length} completed transactions
          </span>
        </Card>

        <Card className="border shadow-2xs rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Orders</span>
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1 font-mono">
            {orders.length}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {paidOrders.length} paid, {orders.length - paidOrders.length} pending/failed
          </span>
        </Card>

        <Card className="border shadow-2xs rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Autopay Subscriptions</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1 font-mono">
            {autopayCount}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Recurring automatic mandate orders
          </span>
        </Card>
      </div>

      {/* Transaction Table */}
      <Card className="border shadow-2xs rounded-2xl overflow-hidden bg-card">
        <CardHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Transaction History
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Live payment records from Razorpay Checkout and Autopay subscriptions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No payment transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">User</TableHead>
                    <TableHead className="text-xs font-semibold">Plan</TableHead>
                    <TableHead className="text-xs font-semibold">Amount</TableHead>
                    <TableHead className="text-xs font-semibold">Payment Mode</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Reference / Order ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((ord) => {
                    const statusLower = ord.status?.toLowerCase();
                    return (
                      <TableRow key={ord.id} className="text-xs">
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(ord.createdAt).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground block">
                              {ord.userName}
                            </span>
                            <span className="text-[11px] text-muted-foreground block">
                              {ord.userEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {ord.planTitle}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground">
                          ${parseFloat(ord.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {ord.paymentMode}
                            </Badge>
                            {ord.isAutopay && (
                              <Badge className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold px-1.5 py-0">
                                Autopay
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              statusLower === 'paid'
                                ? 'default'
                                : statusLower === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className={`text-[10px] uppercase font-bold ${
                              statusLower === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : ''
                            }`}
                          >
                            {ord.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {ord.referenceId ? ord.referenceId.slice(0, 18) + '...' : '—'}
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
