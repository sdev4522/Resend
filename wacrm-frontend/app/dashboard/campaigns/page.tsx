'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { campaignsApi } from '@/lib/api/campaigns';
import { Campaign, CampaignPagination, CampaignStatus } from '@/types/campaign';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Send,
  Search,
  Plus,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  XCircle,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<CampaignPagination>({
    currentPage: 1,
    totalPages: 1,
    totalCampaigns: 0,
    limit: 10,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const params: any = {
        page: pagination.currentPage,
        limit: pagination.limit,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const res = await campaignsApi.getCampaigns(params);

      if (res && res.success) {
        setCampaigns(res.campaigns || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setErrorMessage(res?.error || 'Failed to fetch campaigns');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with broadcast API');
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      setActionLoading(true);
      const res = await campaignsApi.deleteCampaign(campaignToDelete.campaign_id);
      if (res && res.success) {
        setSuccessMessage(`Campaign "${campaignToDelete.title}" deleted.`);
        setCampaignToDelete(null);
        loadCampaigns();
      } else {
        setErrorMessage(res?.error || res?.msg || 'Failed to delete campaign');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: CampaignStatus | string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 animate-pulse">
            <PlayCircle className="h-3 w-3" />
            <span>In Progress</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <Clock className="h-3 w-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30">
            <span>Paused</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <XCircle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <DashboardPageHeader
        title="Broadcast Campaigns"
        description="Schedule, launch, and monitor automated WhatsApp template broadcasts with real-time Meta delivery tracking."
        breadcrumbs={[{ title: 'Campaigns' }]}
        actions={
          <Button size="sm" render={<Link href="/dashboard/campaigns/new" />} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>New Campaign</span>
          </Button>
        }
      />

      {/* Notifications */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Error Notice</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="py-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Filter Toolbar */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaign title or template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
              {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPagination((prev) => ({ ...prev, currentPage: 1 }));
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors touch-manipulation ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {st === 'ALL' ? 'All Campaigns' : st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card className="shadow-xs">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs">Loading broadcast campaigns from server...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <Send className="h-10 w-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Campaigns Found</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {debouncedSearch
                    ? `No campaigns match query "${debouncedSearch}".`
                    : 'Create your first targeted WhatsApp broadcast campaign to reach your customers.'}
                </p>
              </div>
              <Button size="sm" render={<Link href="/dashboard/campaigns/new" />} className="mt-2 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Campaign
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile Campaign Cards (md:hidden) */}
              <div className="md:hidden divide-y divide-border">
                {campaigns.map((c) => (
                  <div key={c.campaign_id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/dashboard/campaigns/${c.campaign_id}`}
                          className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{c.title}</span>
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground font-mono">
                          <span>{c.template_name}</span>
                          <span className="uppercase text-[10px]">({c.template_language})</span>
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(c.status)}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-border/50">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-muted-foreground">
                        <span>{c.phonebook_name || 'General List'}</span>
                        <span className="font-semibold">({c.total_contacts})</span>
                      </span>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span title="Sent" className="text-foreground">{c.sent_count || 0} sent</span>
                        <span title="Delivered" className="text-emerald-600 dark:text-emerald-400">{c.delivered_count || 0} dlvr</span>
                        <span title="Read" className="text-sky-600 dark:text-sky-400">{c.read_count || 0} read</span>
                        {c.failed_count > 0 && (
                          <span title="Failed" className="text-destructive font-semibold">{c.failed_count} fail</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <div>
                        {c.schedule ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(c.schedule).toLocaleString()}</span>
                          </div>
                        ) : (
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          render={<Link href={`/dashboard/campaigns/${c.campaign_id}`} />}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCampaignToDelete(c)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 touch-manipulation"
                          title="Delete Campaign"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead className="font-semibold">Campaign Title</TableHead>
                      <TableHead className="font-semibold">Template</TableHead>
                      <TableHead className="font-semibold">Audience</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      <TableHead className="font-semibold text-center">Delivery Metrics</TableHead>
                      <TableHead className="font-semibold">Created / Scheduled</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.campaign_id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">
                          <Link
                            href={`/dashboard/campaigns/${c.campaign_id}`}
                            className="hover:underline text-foreground font-semibold flex items-center gap-1.5"
                          >
                            <Send className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{c.title}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-foreground">{c.template_name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono">
                              {c.template_language}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-muted-foreground">
                            <span>{c.phonebook_name || 'General List'}</span>
                            <span className="font-semibold">({c.total_contacts})</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {renderStatusBadge(c.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-3 font-mono text-[11px]">
                            <span title="Sent" className="text-foreground">
                              {c.sent_count || 0} sent
                            </span>
                            <span title="Delivered" className="text-emerald-600 dark:text-emerald-400">
                              {c.delivered_count || 0} dlvr
                            </span>
                            <span title="Read" className="text-sky-600 dark:text-sky-400">
                              {c.read_count || 0} read
                            </span>
                            {c.failed_count > 0 && (
                              <span title="Failed" className="text-destructive font-semibold">
                                {c.failed_count} fail
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {c.schedule ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(c.schedule).toLocaleString()}</span>
                            </div>
                          ) : (
                            <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              render={<Link href={`/dashboard/campaigns/${c.campaign_id}`} />}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="View Campaign Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCampaignToDelete(c)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="Delete Campaign"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t text-xs text-muted-foreground">
              <span>
                Showing {campaigns.length} of {pagination.totalCampaigns} campaigns
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }))
                  }
                  className="h-8 px-2.5 gap-1 text-xs touch-manipulation"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <span>
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }))
                  }
                  className="h-8 px-2.5 gap-1 text-xs touch-manipulation"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Campaign Confirmation Dialog */}
      <AlertDialog
        open={Boolean(campaignToDelete)}
        onOpenChange={(open) => !open && setCampaignToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete campaign &ldquo;{campaignToDelete?.title}&rdquo;?
              This will also purge all message delivery logs for this broadcast.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deleting...' : 'Delete Campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
