'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi } from '@/lib/api/campaigns';
import { Campaign, CampaignLog } from '@/types/campaign';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  ArrowLeft,
  Loader2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  Users,
  CheckCheck,
  Eye,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCampaignData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const res = await campaignsApi.getCampaignDetail(campaignId);

      if (res && res.success && res.campaign) {
        setCampaign(res.campaign);
        setLogs(res.logs || []);
      } else {
        setError(res?.error || 'Campaign not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch campaign details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaignData();
  }, [loadCampaignData]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await campaignsApi.deleteCampaign(campaignId);
      if (res && res.success) {
        router.push('/dashboard/campaigns?deleted=true');
      } else {
        setError(res?.error || res?.msg || 'Failed to delete campaign.');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting campaign.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading campaign analytics & logs...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/campaigns" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Campaign Not Found</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {error || 'Unable to retrieve campaign details.'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" render={<Link href="/dashboard/campaigns" />}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const total = campaign.total_contacts || 0;
  const sent = campaign.sent_count || 0;
  const delivered = campaign.delivered_count || 0;
  const read = campaign.read_count || 0;
  const failed = campaign.failed_count || 0;

  const progressPercent = total > 0 ? Math.min(100, Math.round(((sent + failed) / total) * 100)) : 0;
  const deliveredPercent = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const readPercent = total > 0 ? Math.round((read / total) * 100) : 0;

  const renderStatusBadge = () => {
    switch (campaign.status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 animate-pulse">
            <PlayCircle className="h-3.5 w-3.5" /> In Progress
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <Clock className="h-3.5 w-3.5" /> Scheduled
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30">
            Paused
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
            {campaign.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/campaigns" />}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {campaign.title}
              </h1>
              {renderStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Template: <span className="font-mono text-foreground">{campaign.template_name}</span> (
              {campaign.template_language}) | Phonebook:{' '}
              <span className="font-semibold text-foreground">{campaign.phonebook_name || 'Audience'}</span> | ID:{' '}
              <span className="font-mono text-[11px]">{campaign.campaign_id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadCampaignData(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh Stats</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete campaign &ldquo;{campaign.title}&rdquo; and all associated delivery tracking logs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? 'Deleting...' : 'Delete Campaign'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <Users className="h-3.5 w-3.5" /> Total Audience
            </span>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {total}
            </div>
            <span className="text-[10px] text-muted-foreground">Recipients queued</span>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <Send className="h-3.5 w-3.5 text-primary" /> Dispatched
            </span>
            <div className="text-2xl font-bold tracking-tight text-primary font-mono">
              {sent}
            </div>
            <span className="text-[10px] text-muted-foreground">{progressPercent}% of audience</span>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Delivered
            </span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {delivered}
            </div>
            <span className="text-[10px] text-muted-foreground">{deliveredPercent}% deliverability</span>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <Eye className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Read / Opened
            </span>
            <div className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 font-mono">
              {read}
            </div>
            <span className="text-[10px] text-muted-foreground">{readPercent}% open rate</span>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <XCircle className="h-3.5 w-3.5 text-destructive" /> Failed
            </span>
            <div className="text-2xl font-bold tracking-tight text-destructive font-mono">
              {failed}
            </div>
            <span className="text-[10px] text-muted-foreground">Undelivered</span>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar Card */}
      <Card className="shadow-xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between text-xs">
            <CardTitle className="text-sm font-semibold">Broadcast Progress</CardTitle>
            <span className="font-mono font-semibold text-foreground">{progressPercent}%</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {sent + failed} of {total} messages processed by background dispatcher
            </span>
            {campaign.schedule && (
              <span>Scheduled dispatch: {new Date(campaign.schedule).toLocaleString()}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Logs Table */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recipient Delivery Logs</CardTitle>
            <CardDescription className="text-xs">
              Live recipient status tracked via Meta WhatsApp Cloud API webhooks.
            </CardDescription>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {logs.length} recipient log(s)
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs font-medium">No recipient logs generated yet</p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Logs will populate as the background dispatcher processes recipients.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/40">
                    <TableHead className="font-semibold">Recipient Name</TableHead>
                    <TableHead className="font-semibold">Mobile Number</TableHead>
                    <TableHead className="font-semibold text-center">Dispatch Status</TableHead>
                    <TableHead className="font-semibold text-center">Delivery Status</TableHead>
                    <TableHead className="font-semibold">Timestamp</TableHead>
                    <TableHead className="font-semibold font-mono">Meta Msg ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {log.contact_name || <span className="text-muted-foreground italic">Unnamed</span>}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {log.contact_mobile}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            log.status === 'SENT'
                              ? 'bg-primary/10 text-primary'
                              : log.status === 'FAILED'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {log.delivery_status === 'read' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                            <CheckCheck className="h-3.5 w-3.5" /> Read
                          </span>
                        )}
                        {log.delivery_status === 'delivered' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCheck className="h-3.5 w-3.5" /> Delivered
                          </span>
                        )}
                        {log.delivery_status === 'sent' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                          </span>
                        )}
                        {log.delivery_status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                        {!log.delivery_status && (
                          <span className="text-[11px] text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {log.delivery_time
                          ? new Date(log.delivery_time).toLocaleTimeString()
                          : new Date(log.createdAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[140px] truncate">
                        {log.meta_msg_id || (
                          log.error_message ? (
                            <span className="text-destructive font-sans text-[10px]" title={log.error_message}>
                              {log.error_message}
                            </span>
                          ) : (
                            '—'
                          )
                        )}
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
