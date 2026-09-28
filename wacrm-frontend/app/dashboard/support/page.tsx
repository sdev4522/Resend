'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LifeBuoy,
  MessageSquare,
  Search,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  BookOpen,
  ArrowLeft,
  XCircle,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { supportApi } from '@/lib/api/support';
import {
  SupportTicket,
  SupportMessage,
  SupportCategory,
  SupportPriority,
  SupportStatus,
  SupportCounts,
} from '@/types/support';

const CATEGORIES: { label: string; value: SupportCategory }[] = [
  { label: 'Technical Issue', value: 'technical' },
  { label: 'WhatsApp Connection', value: 'whatsapp' },
  { label: 'Billing & Plans', value: 'billing' },
  { label: 'Campaigns & Broadcasts', value: 'campaign' },
  { label: 'Automation & Chatbots', value: 'automation' },
  { label: 'Account & Workspaces', value: 'account' },
  { label: 'Other Inquiries', value: 'other' },
];

const PRIORITIES: { label: string; value: SupportPriority }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

const KNOWLEDGE_ARTICLES = [
  {
    title: 'Connecting WhatsApp Cloud API',
    category: 'WhatsApp',
    summary: 'Step-by-step setup guide for Meta Developer app credentials and webhook configuration.',
    link: '/dashboard/integrations',
  },
  {
    title: 'Message Deliverability & Quality Rating',
    category: 'Campaigns',
    summary: 'Best practices to maintain high WhatsApp tier ratings and avoid account bans.',
    link: '/dashboard/campaigns',
  },
  {
    title: 'Configuring Interactive Flow Chatbots',
    category: 'Automation',
    summary: 'Build conversational decision trees and multi-step customer qualification flows.',
    link: '/dashboard/flows',
  },
  {
    title: 'Developer REST API Authentication',
    category: 'API & Webhooks',
    summary: 'Generate scoped API tokens and verify signatures for inbound webhook events.',
    link: '/dashboard/developer',
  },
];

function UserSupportContent() {
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get('ticket');

  const [activeTab, setActiveTab] = useState<'tickets' | 'new' | 'help'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<SupportCounts>({ all: 0, open: 0, resolved: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Ticket Detail State
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(
    ticketParam ? parseInt(ticketParam, 10) : null
  );
  const [ticketDetail, setTicketDetail] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // New Ticket Form State
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<SupportCategory>('technical');
  const [newPriority, setNewPriority] = useState<SupportPriority>('normal');
  const [newMessage, setNewMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supportApi.getUserTickets();
      if (res.success) {
        setTickets(res.tickets || []);
        setCounts(res.counts || { all: 0, open: 0, resolved: 0, closed: 0 });
      } else {
        setError('Unable to load support requests. Please try again.');
      }
    } catch {
      setError('Failed to connect to support services. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const loadTicketDetail = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await supportApi.getTicketDetail(id);
      if (res.success) {
        setTicketDetail(res.ticket);
        setMessages(res.messages || []);
        setSelectedTicketId(id);
      }
    } catch (err) {
      console.error('Failed to load ticket detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    }
  }, [selectedTicketId]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newSubject.trim()) {
      setFormError('Please enter a descriptive subject for your request.');
      return;
    }

    if (!newMessage.trim() || newMessage.trim().length < 10) {
      setFormError('Please provide details for your issue (at least 10 characters).');
      return;
    }

    setIsCreating(true);
    try {
      const res = await supportApi.createTicket({
        subject: newSubject.trim(),
        category: newCategory,
        priority: newPriority,
        message: newMessage.trim(),
      });

      if (res.success && res.ticket) {
        setFormSuccess(true);
        setNewSubject('');
        setNewMessage('');
        await fetchTickets();
        setTimeout(() => {
          setFormSuccess(false);
          setActiveTab('tickets');
          setSelectedTicketId(res.ticket.id);
        }, 1200);
      } else {
        setFormError(res.msg || 'Failed to submit request. Please try again.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Server error submitting ticket.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !replyMessage.trim()) return;

    setIsSubmittingReply(true);
    try {
      const res = await supportApi.replyTicket(selectedTicketId, replyMessage.trim());
      if (res.success) {
        setReplyMessage('');
        await loadTicketDetail(selectedTicketId);
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicketId) return;
    try {
      const res = await supportApi.closeTicket(selectedTicketId);
      if (res.success) {
        await loadTicketDetail(selectedTicketId);
        await fetchTickets();
      }
    } catch (err) {
      console.error('Failed to close ticket:', err);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'open'
          ? t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_user'
          : t.status === statusFilter;

    const matchesSearch =
      !searchQuery.trim() ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">In Progress</Badge>;
      case 'waiting_user':
        return <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">Waiting on You</Badge>;
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Help & Customer Support
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get assistance from the engineering and support team, browse documentation, or track open requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            disabled={isLoading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedTicketId(null);
              setActiveTab('new');
            }}
            className="h-9 gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="tickets" className="text-xs sm:text-sm gap-1.5">
            <MessageSquare className="h-4 w-4" />
            My Requests
            {counts.all > 0 && (
              <Badge variant="secondary" className="ml-1 text-[11px] h-4.5 px-1.5">
                {counts.all}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs sm:text-sm gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Submit Request
          </TabsTrigger>
          <TabsTrigger value="help" className="text-xs sm:text-sm gap-1.5">
            <BookOpen className="h-4 w-4" />
            Help Resources & FAQ
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: MY TICKETS / CONVERSATION VIEW ── */}
        <TabsContent value="tickets" className="space-y-4">
          {selectedTicketId && ticketDetail ? (
            /* Detailed Ticket Thread */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTicketId(null)}
                className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to All Requests
              </Button>

              <Card className="border-border/60 bg-card">
                <CardHeader className="border-b border-border/40 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
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
                      <h2 className="text-xl font-bold mt-2 text-foreground">
                        {ticketDetail.subject}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Opened on {new Date(ticketDetail.created_at).toLocaleDateString()} at{' '}
                        {new Date(ticketDetail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {ticketDetail.status !== 'closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCloseTicket}
                        className="text-xs border-muted-foreground/30 hover:border-destructive hover:text-destructive gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Mark as Closed
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {/* Messages Timeline */}
                <CardContent className="p-4 sm:p-6 space-y-4 max-h-[600px] overflow-y-auto">
                  {isLoadingDetail ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full rounded-lg" />
                      <Skeleton className="h-24 w-3/4 ml-auto rounded-lg" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No message history found for this request.
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.sender_type === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col p-4 rounded-xl border transition-colors ${isAdmin
                            ? 'bg-primary/5 border-primary/20 mr-auto max-w-[85%]'
                            : 'bg-muted/40 border-border/60 ml-auto max-w-[85%]'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2">
                              {isAdmin ? (
                                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-semibold">
                                  Support Team
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  You
                                </Badge>
                              )}
                              <span className="text-xs font-medium text-foreground">
                                {msg.sender_name}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {msg.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>

                {/* Reply Composer */}
                {ticketDetail.status !== 'closed' ? (
                  <CardFooter className="border-t border-border/40 p-4 sm:p-6 flex flex-col gap-3">
                    <Label htmlFor="reply-input" className="text-xs font-medium text-muted-foreground">
                      Reply to this thread
                    </Label>
                    <Textarea
                      id="reply-input"
                      placeholder="Type your response or provide additional details..."
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="resize-none"
                    />
                    <div className="flex justify-end w-full">
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={!replyMessage.trim() || isSubmittingReply}
                        className="gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isSubmittingReply ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </CardFooter>
                ) : (
                  <CardFooter className="border-t border-border/40 p-4 bg-muted/20 text-center text-xs text-muted-foreground justify-center">
                    This support ticket has been closed. Open a new request if you need additional help.
                  </CardFooter>
                )}
              </Card>
            </div>
          ) : (
            /* Tickets List View */
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticket number, subject, or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <Button
                    variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className="h-8 text-xs"
                  >
                    All ({counts.all})
                  </Button>
                  <Button
                    variant={statusFilter === 'open' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('open')}
                    className="h-8 text-xs"
                  >
                    Open ({counts.open})
                  </Button>
                  <Button
                    variant={statusFilter === 'resolved' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('resolved')}
                    className="h-8 text-xs"
                  >
                    Resolved ({counts.resolved})
                  </Button>
                  <Button
                    variant={statusFilter === 'closed' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('closed')}
                    className="h-8 text-xs"
                  >
                    Closed ({counts.closed})
                  </Button>
                </div>
              </div>

              {/* Tickets Table / List */}
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : error ? (
                <Card className="p-8 text-center border-dashed">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" size="sm" onClick={fetchTickets} className="mt-4">
                    Retry
                  </Button>
                </Card>
              ) : filteredTickets.length === 0 ? (
                <Card className="p-10 text-center border-dashed bg-card/40">
                  <HelpCircle className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="font-semibold text-base text-foreground">No support requests found</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {searchQuery
                      ? 'No requests matched your search criteria.'
                      : 'You do not have any open support inquiries. Need help? Create a new ticket.'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('new')}
                    className="mt-4 gap-1.5 max-w-fit m-auto px-3 py-2 text-sm"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Submit Request
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:border-foreground/20 hover:bg-accent/30 cursor-pointer transition-all gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="mt-0.5 sm:mt-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground font-semibold">
                              #{t.ticket_number}
                            </span>
                            {getStatusBadge(t.status)}
                            {getPriorityBadge(t.priority)}
                            <span className="text-[11px] text-muted-foreground capitalize">
                              • {t.category}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm text-foreground mt-1 group-hover:text-primary transition-colors line-clamp-1">
                            {t.subject}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-muted-foreground pl-12 sm:pl-0">
                        <div className="text-right">
                          <p>
                            Updated{' '}
                            {new Date(t.updated_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-[11px] opacity-75">
                            {t.message_count || 1} {t.message_count === 1 ? 'message' : 'messages'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: SUBMIT NEW REQUEST ── */}
        <TabsContent value="new">
          <Card className="border-border/60 bg-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                Submit a Support Request
              </CardTitle>
              <CardDescription>
                Provide details about the issue or question. Our engineering and customer success teams will review and respond.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateTicket}>
              <CardContent className="space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Your request has been submitted successfully. Redirecting to ticket...</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ticket-subject" className="text-xs font-medium">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ticket-subject"
                    placeholder="e.g. WhatsApp QR session disconnected after server reboot"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    disabled={isCreating}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Category</Label>
                    <Select
                      value={newCategory}
                      onValueChange={(val) => setNewCategory(val as SupportCategory)}
                      disabled={isCreating}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Priority Level</Label>
                    <Select
                      value={newPriority}
                      onValueChange={(val) => setNewPriority(val as SupportPriority)}
                      disabled={isCreating}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Priority" />
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

                <div className="space-y-1.5">
                  <Label htmlFor="ticket-message" className="text-xs font-medium">
                    Detailed Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="ticket-message"
                    placeholder="Describe what occurred, steps to reproduce, or any relevant details..."
                    rows={6}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isCreating}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Minimum 10 characters. Avoid sharing sensitive passwords or private access tokens.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border/40 p-4 sm:p-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('tickets')}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isCreating} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isCreating ? 'Submitting...' : 'Submit Request'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ── TAB 3: HELP & DOCUMENTATION RESOURCES ── */}
        <TabsContent value="help" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KNOWLEDGE_ARTICLES.map((article) => (
              <Card
                key={article.title}
                className="border-border/60 bg-card hover:border-foreground/20 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-medium">
                      {article.category}
                    </Badge>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-base font-semibold mt-2 text-foreground">
                    {article.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed mt-1">
                    {article.summary}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0">
                  <Link
                    href={article.link}
                    className="inline-flex items-center text-primary text-xs font-medium gap-1 hover:underline"
                  >
                    View Guide <ChevronRight className="h-3 w-3" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="border-border/60 bg-card/60 p-6">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Frequently Asked Support Questions
            </h3>
            <div className="mt-4 space-y-4 text-sm divide-y divide-border/40">
              <div className="pt-3 first:pt-0">
                <h4 className="font-medium text-foreground">
                  How quickly does the support team reply?
                </h4>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Support requests are prioritized by tier and urgency. Urgent operational issues receive expedited review within business hours.
                </p>
              </div>
              <div className="pt-3">
                <h4 className="font-medium text-foreground">
                  Can I attach media or error logs to a ticket?
                </h4>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Yes, you can describe error logs in the request description or reference webhook delivery IDs directly from your Developer API console.
                </p>
              </div>
              <div className="pt-3">
                <h4 className="font-medium text-foreground">
                  Where do I manage WhatsApp account numbers?
                </h4>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Head to the Integrations page to manage official Meta Cloud API accounts or QR connections for your workspace.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function UserSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted/60 animate-pulse rounded" />
          <div className="h-40 w-full bg-muted/30 animate-pulse rounded-xl" />
        </div>
      }
    >
      <UserSupportContent />
    </Suspense>
  );
}
