'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { templatesApi } from '@/lib/api/templates';
import {
  MetaTemplate,
  LocalTemplate,
  MetaConnectionStatus,
} from '@/types/template';
import { TemplateStatusBadge } from '@/components/templates/template-status-badge';
import { TemplateDetailDialog } from '@/components/templates/template-detail-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  Globe,
  Settings,
  ShieldCheck,
  FileText,
} from 'lucide-react';

function TemplatesContent() {
  const searchParams = useSearchParams();
  const justCreated = searchParams.get('created') === 'true';

  // State
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [localTemplates, setLocalTemplates] = useState<LocalTemplate[]>([]);
  const [metaStatus, setMetaStatus] = useState<MetaConnectionStatus>({ configured: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Dialog state
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MetaTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success message after creation
  const [showCreatedNotice, setShowCreatedNotice] = useState(justCreated);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await templatesApi.getMetaConnectionStatus();
      setMetaStatus(statusRes);

      const [metaRes, localRes] = await Promise.allSettled([
        templatesApi.getMetaTemplates(),
        templatesApi.getLocalTemplates(),
      ]);

      if (metaRes.status === 'fulfilled' && metaRes.value.success) {
        setMetaTemplates(metaRes.value.data || []);
        setLastSynced(new Date());
      } else if (metaRes.status === 'fulfilled' && !metaRes.value.success) {
        // If meta not configured or returned API error
        if (statusRes.configured) {
          setError(metaRes.value.msg || 'Failed to fetch templates from Meta Cloud API.');
        }
      }

      if (localRes.status === 'fulfilled' && localRes.value.success) {
        setLocalTemplates(localRes.value.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with template services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSyncWithMeta = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await templatesApi.getMetaTemplates();
      if (res.success && Array.isArray(res.data)) {
        setMetaTemplates(res.data);
        setLastSynced(new Date());
      } else {
        setError(res.msg || 'Meta sync failed. Please verify your Meta Cloud API settings.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during Meta synchronization.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await templatesApi.deleteMetaTemplate(templateToDelete.name);
      if (res.success) {
        setTemplateToDelete(null);
        await handleSyncWithMeta();
      } else {
        setDeleteError(res.msg || 'Meta rejected the deletion request.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error occurred while deleting template from Meta.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered Meta Templates
  const filteredMetaTemplates = useMemo(() => {
    return metaTemplates.filter((t) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || t.name.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [metaTemplates, searchQuery, statusFilter, categoryFilter]);

  const handleOpenDetail = (template: MetaTemplate) => {
    setSelectedTemplate(template);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              WhatsApp Templates
            </h1>
            {metaStatus.configured ? (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-mono text-xs gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                WABA CONNECTED
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 font-mono text-xs gap-1"
              >
                DISCONNECTED
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Meta Cloud API message templates and quick response presets.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncWithMeta}
            disabled={syncing || loading || !metaStatus.configured}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync with Meta
          </Button>

          <Button size="sm" render={<Link href="/dashboard/templates/new" />} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Created Notice Banner */}
      {showCreatedNotice && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-sm font-semibold">Template Submitted to Meta!</AlertTitle>
          <AlertDescription className="text-xs mt-1 flex items-center justify-between">
            <span>
              Your template has been submitted to Meta and is in <strong>PENDING</strong> status. Review typically completes within minutes to 24 hours.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreatedNotice(false)}
              className="h-6 text-xs"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Meta API Disconnected Banner */}
      {!loading && !metaStatus.configured && (
        <Alert className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm font-semibold text-foreground">
            Meta Cloud API Not Configured
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              To sync official WhatsApp templates with Meta, please configure your WhatsApp Business Account (WABA ID) and Cloud API Access Token.
            </span>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/dashboard/settings" />}
              className="gap-1.5 self-start sm:self-auto shrink-0 border-amber-300"
            >
              <Settings className="h-3.5 w-3.5" />
              Configure in Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Error alert if any */}
      {error && (
        <Alert variant="destructive" className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Meta Template Synchronization Notice</AlertTitle>
          <AlertDescription className="text-xs mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleSyncWithMeta} className="h-7 text-xs gap-1">
              <RefreshCw className="h-3 w-3" /> Retry Sync
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="meta" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="meta" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Meta Cloud API Templates ({metaTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="local" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Local Quick Replies ({localTemplates.length})
            </TabsTrigger>
          </TabsList>

          {lastSynced && (
            <div className="text-[11px] text-muted-foreground font-mono">
              Last synced: {lastSynced.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Tab 1: Meta Cloud API Templates */}
        <TabsContent value="meta" className="space-y-4 m-0">
          {/* Filters toolbar */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative sm:col-span-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by template name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "ALL")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || "ALL")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filter by Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredMetaTemplates.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Layers className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">No templates found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                      ? 'No templates match your active filters. Try clearing or changing filters.'
                      : metaStatus.configured
                      ? 'No message templates are registered in your Meta Business Account. Create your first template to get started.'
                      : 'Connect your Meta WhatsApp Business Account to sync existing templates.'}
                  </p>
                  {metaStatus.configured && (
                    <Button
                      size="sm"
                      render={<Link href="/dashboard/templates/new" />}
                      className="mt-2 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Template
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile Template Cards (md:hidden) */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredMetaTemplates.map((template) => {
                      const bodyComp = template.components?.find((c) => c.type === 'BODY') as any;
                      const hasHeader = template.components?.some((c) => c.type === 'HEADER');
                      const hasButtons = template.components?.some((c) => c.type === 'BUTTONS');

                      return (
                        <div key={template.name} className="p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-semibold text-sm text-foreground font-mono truncate block">
                                {template.name}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-normal py-0">
                                  {template.category}
                                </Badge>
                                <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {template.language}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <TemplateStatusBadge status={template.status} />
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 p-2 rounded-lg border border-border/40 font-normal">
                            {bodyComp?.text || '—'}
                          </p>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1">
                              {hasHeader && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  Header
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                Body
                              </Badge>
                              {hasButtons && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  Buttons
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDetail(template)}
                                className="h-8 px-2 text-xs gap-1 text-primary touch-manipulation"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Preview</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setTemplateToDelete(template)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 touch-manipulation"
                                title="Delete Template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (hidden md:block) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-[260px]">Template Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Language</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Components</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMetaTemplates.map((template) => {
                          const bodyComp = template.components?.find((c) => c.type === 'BODY') as any;
                          const hasHeader = template.components?.some((c) => c.type === 'HEADER');
                          const hasButtons = template.components?.some((c) => c.type === 'BUTTONS');

                          return (
                            <TableRow key={template.name} className="hover:bg-muted/30">
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm text-foreground font-mono">
                                    {template.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                    {bodyComp?.text || '—'}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <Badge variant="outline" className="text-xs font-normal">
                                  {template.category}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {template.language}
                                </span>
                              </TableCell>

                              <TableCell>
                                <TemplateStatusBadge status={template.status} />
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {hasHeader && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Header
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Body
                                  </Badge>
                                  {hasButtons && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Buttons
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDetail(template)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      <span>View / Test Preview</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setTemplateToDelete(template)}
                                      className="text-destructive focus:text-destructive cursor-pointer"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete Template</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Local Quick Replies */}
        <TabsContent value="local" className="space-y-4 m-0">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Inbox Quick Replies</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Local preset snippets used by human agents in the inbox and chat flows.
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {localTemplates.length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground">
                  No local quick reply templates created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localTemplates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-sm">{t.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {t.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                            {typeof t.content === 'string' ? t.content : JSON.stringify(t.content)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail / Interactive Preview Dialog */}
      <TemplateDetailDialog
        template={selectedTemplate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete Meta WhatsApp Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete template <strong>{templateToDelete?.name}</strong> from your Meta WhatsApp Business Account?
              This action permanently deletes the template from Meta Graph API. Any scheduled campaigns or automated flows referencing this template will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="py-2.5 my-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{deleteError}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteTemplate();
              }}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete from Meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="p-6 space-y-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /></div>}>
      <TemplatesContent />
    </Suspense>
  );
}
