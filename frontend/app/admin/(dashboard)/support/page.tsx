'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LifeBuoy,
  Search,
  RefreshCw,
  AlertCircle,
  Send,
  User,
  Building,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { supportApi } from '@/lib/api/support';
import {
  SupportTicket,
  SupportMessage,
  SupportStatus,
  SupportPriority,
  SupportCounts,
} from '@/types/support';

const CATEGORIES = [
  { label: 'All Categories', value: 'all' },
  { label: 'Technical', value: 'technical' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Billing', value: 'billing' },
  { label: 'Campaigns', value: 'campaign' },
  { label: 'Automation', value: 'automation' },
  { label: 'Account', value: 'account' },
  { label: 'Other', value: 'other' },
];

const PRIORITIES = [
  { label: 'All Priorities', value: 'all' },
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<SupportCounts>({
    all: 0,
    open: 0,
    in_progress: 0,
    waiting_user: 0,
    resolved: 0,
    closed: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Detail Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [adminReply, setAdminReply] = useState('');
  const [replyStatus, setReplyStatus] = useState<SupportStatus>('in_progress');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchTickets = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supportApi.getAdminTickets({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        page,
        limit: 20,
      });

      if (res.success) {
        setTickets(res.tickets || []);
        setTotal(res.total || 0);
        setCounts(
          res.counts || { all: 0, open: 0, in_progress: 0, waiting_user: 0, resolved: 0, closed: 0 }
        );
      } else {
        setError('Failed to fetch support requests from server.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading tickets.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter, priorityFilter, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  const openTicketDetail = async (id: number) => {
    setSelectedTicketId(id);
    setIsLoadingDetail(true);
    try {
      const res = await supportApi.getAdminTicketDetail(id);
      if (res.success) {
        setTicketDetail(res.ticket);
        setMessages(res.messages || []);
        setReplyStatus(res.ticket.status === 'open' ? 'in_progress' : res.ticket.status);
      }
    } catch (err) {
      console.error('Failed to load admin ticket detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSendAdminReply = async () => {
    if (!selectedTicketId || !adminReply.trim()) return;

    setIsSubmittingReply(true);
    try {
      const res = await supportApi.adminReply(selectedTicketId, adminReply.trim(), replyStatus);
      if (res.success) {
        setAdminReply('');
        await openTicketDetail(selectedTicketId);
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to send admin reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: SupportStatus) => {
    if (!selectedTicketId) return;

    setIsUpdatingStatus(true);
    try {
      const res = await supportApi.adminUpdateStatus(selectedTicketId, newStatus);
      if (res.success) {
        await openTicketDetail(selectedTicketId);
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">In Progress</Badge>;
      case 'waiting_user':
        return <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">Waiting User</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Resolved</Badge>;
      case 'closed':
        return <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/20">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: SupportPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">High</Badge>;
      case 'normal':
        return <Badge variant="secondary" className="text-[10px]">Normal</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Low</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <LifeBuoy className="h-6 w-6 text-red-500" />
            Customer Support Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor incoming customer requests, investigate workspace issues, and manage resolution workflows.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchTickets}
          disabled={isLoading}
          className="h-9 gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Requests
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Total Requests</span>
          <p className="text-2xl font-bold text-foreground mt-1">{counts.all}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-blue-400">Open & Active</span>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {(counts.open || 0) + (counts.in_progress || 0)}
          </p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-emerald-400">Resolved</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{counts.resolved || 0}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Closed</span>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{counts.closed || 0}</p>
        </Card>
      </div>

      {/* Search & Filter Controls */}
      <Card className="border-border/60 bg-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket #, subject, customer email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_user">Waiting User</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                if (val) setCategoryFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[135px] text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(val) => {
                if (val) setPriorityFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[125px] text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tickets Table */}
      <Card className="border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold text-base text-foreground">No support tickets match filters</h3>
            <p className="text-xs mt-1">Adjust search parameters or clear filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-[120px] text-xs">Ticket #</TableHead>
                  <TableHead className="text-xs">Subject & Requester</TableHead>
                  <TableHead className="w-[110px] text-xs">Category</TableHead>
                  <TableHead className="w-[90px] text-xs">Priority</TableHead>
                  <TableHead className="w-[110px] text-xs">Status</TableHead>
                  <TableHead className="w-[130px] text-xs">Last Updated</TableHead>
                  <TableHead className="w-[80px] text-right text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => openTicketDetail(t.id)}
                    className="cursor-pointer border-border/40 hover:bg-accent/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                      #{t.ticket_number}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-foreground hover:text-primary transition-colors">
                        {t.subject}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{t.user_name || t.user_email || 'Workspace User'}</span>
                        {t.user_company && (
                          <span className="opacity-75">• {t.user_company}</span>
                        )}
                        <span className="opacity-75">
                          • {t.message_count || 1} msg
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">
                      {t.category}
                    </TableCell>
                    <TableCell>{getPriorityBadge(t.priority)}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTicketDetail(t.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 text-xs text-muted-foreground bg-muted/20">
            <span>
              Showing {tickets.length} of {total} request{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={tickets.length < 20 || page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Ticket Detail & Reply Modal */}
      <Dialog
        open={selectedTicketId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null);
            setTicketDetail(null);
            setMessages([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-border/40 pb-4">
            {ticketDetail && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground font-semibold">
                      #{ticketDetail.ticket_number}
                    </span>
                    {getStatusBadge(ticketDetail.status)}
                    {getPriorityBadge(ticketDetail.priority)}
                    <Badge variant="outline" className="capitalize text-xs">
                      {ticketDetail.category}
                    </Badge>
                  </div>

                  {/* Status update selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select
                      value={ticketDetail.status}
                      onValueChange={(val) => handleQuickStatusChange(val as SupportStatus)}
                      disabled={isUpdatingStatus}
                    >
                      <SelectTrigger className="h-7 text-xs w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_user">Waiting User</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogTitle className="text-lg font-bold text-foreground">
                  {ticketDetail.subject}
                </DialogTitle>

                {/* Requester Profile Strip */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-foreground/70" />
                    <span className="font-medium text-foreground">{ticketDetail.user_name || 'User'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{ticketDetail.user_email || 'No email'}</span>
                  </div>
                  {ticketDetail.user_company && (
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" />
                      <span>{ticketDetail.user_company}</span>
                    </div>
                  )}
                  {ticketDetail.user_mobile && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{ticketDetail.user_mobile}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Conversation Messages */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {isLoadingDetail ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-3/4 ml-auto" />
              </div>
            ) : (
              messages.map((m) => {
                const isAdmin = m.sender_type === 'admin';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col p-4 rounded-xl border ${
                      isAdmin
                        ? 'bg-red-500/5 border-red-500/20 ml-auto max-w-[85%]'
                        : 'bg-muted/40 border-border/60 mr-auto max-w-[85%]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <Badge className="bg-red-600/20 text-red-400 border border-red-500/30 text-[10px]">
                            WaCRM Support
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Customer
                          </Badge>
                        )}
                        <span className="text-xs font-medium text-foreground">{m.sender_name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin Reply Box */}
          <DialogFooter className="p-4 sm:p-6 border-t border-border/40 bg-card flex flex-col gap-3">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-reply-box" className="text-xs font-medium text-muted-foreground">
                  Reply to Customer
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Set status to:</span>
                  <Select
                    value={replyStatus}
                    onValueChange={(val) => setReplyStatus(val as SupportStatus)}
                  >
                    <SelectTrigger className="h-7 text-xs w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_user">Waiting User</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                id="admin-reply-box"
                placeholder="Type response to workspace owner..."
                rows={3}
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                className="resize-none"
              />

              <div className="flex justify-end gap-2 mt-1">
                <Button
                  size="sm"
                  onClick={handleSendAdminReply}
                  disabled={!adminReply.trim() || isSubmittingReply}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmittingReply ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
