'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import {
  ArrowRight,
  CheckCircle2,
  CheckCheck,
  Send,
  Zap,
  Sparkles,
  Search,
  Lock,
  Phone,
  Paperclip,
  Radio,
  FileText,
  MoreVertical,
} from 'lucide-react';

interface ConversationItem {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  tag: string;
  agent: string;
  status: 'delivered' | 'read';
}

const SAMPLE_CONVERSATIONS: ConversationItem[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    phone: '+1 (415) 555-0198',
    lastMessage: 'Does the team inbox support concurrent agents?',
    time: 'Just now',
    unread: 1,
    tag: 'Enterprise Lead',
    agent: 'Elena R.',
    status: 'delivered',
  },
  {
    id: '2',
    name: 'Marcus Cole',
    phone: '+44 20 7946 0912',
    lastMessage: 'Broadcast campaign scheduled for 10,000 users.',
    time: '4m ago',
    unread: 0,
    tag: 'Campaign Active',
    agent: 'Alex K.',
    status: 'read',
  },
  {
    id: '3',
    name: 'Elena Rostova',
    phone: '+49 30 1234 5678',
    lastMessage: 'Template "welcome_promo" approved by Meta.',
    time: '18m ago',
    unread: 0,
    tag: 'Meta Template',
    agent: 'David M.',
    status: 'read',
  },
];

export function MarketingHero() {
  const { openRegister } = useAuthDialog();
  const [activeChat, setActiveChat] = useState<string>('1');

  const selectedConv =
    SAMPLE_CONVERSATIONS.find((c) => c.id === activeChat) ||
    SAMPLE_CONVERSATIONS[0];

  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
      {/* Subtle background ambient grid (no neon blobs or distracting gradients) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,168,132,0.08),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline, Value Proposition & Actions */}
          <div className="flex flex-col items-center text-center lg:col-span-5 lg:items-start lg:text-left">
            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary backdrop-blur-xs transition-colors hover:bg-primary/10 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Official Meta Cloud API &amp; QR Engine</span>
            </div>

            {/* Primary Headline (Preserved Exact Core Message) */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]">
              Get WhatsApp API in{' '}
              <span className="text-primary underline decoration-primary/30 decoration-wavy decoration-2 underline-offset-6">
                5 Minutes
              </span>
            </h1>

            {/* Supporting Value Message */}
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Connect WhatsApp, manage customer conversations with your team, launch verified template campaigns, and automate support from one unified CRM workspace.
            </p>

            {/* Action CTAs */}
            <div className="mt-8 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                onClick={openRegister}
                className="group h-12 rounded-full px-8 text-base font-semibold shadow-sm cursor-pointer"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                render={<Link href="/#features" />}
                className="h-12 rounded-full px-7 text-base font-medium text-foreground hover:bg-muted/80 cursor-pointer"
              >
                Explore Features
              </Button>
            </div>

            {/* Trust and Key Capabilities List */}
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-md pt-2 border-t border-border/50 text-left">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>14-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Multi-Agent Team Inbox</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Meta-Approved Broadcasts</span>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic WhatsApp Workspace Product Preview */}
          <div className="lg:col-span-7">
            <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden transition-all duration-300 hover:border-foreground/20">
              {/* Product Preview Top Bar */}
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground hidden sm:inline">
                    resend.in/dashboard/inbox
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold gap-1 py-0.5"
                  >
                    <Radio className="h-2.5 w-2.5 animate-pulse text-primary" />
                    Connected · Meta Cloud API
                  </Badge>
                  <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                    Number: +1 (800) 555-CRM
                  </span>
                </div>
              </div>

              {/* 2-Pane Inbox Mockup */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-background">
                {/* Left Pane: Conversation Queue (5 cols on md) */}
                <div className="md:col-span-5 border-r border-border/70 flex flex-col bg-muted/10">
                  <div className="p-3 border-b border-border/70">
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        readOnly
                        value="Search chats or tags..."
                        className="w-full rounded-md border border-border/60 bg-background/80 pl-8 pr-3 py-1.5 text-xs text-muted-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex-1 divide-y divide-border/50 overflow-y-auto">
                    {SAMPLE_CONVERSATIONS.map((conv) => {
                      const isSelected = conv.id === selectedConv.id;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => setActiveChat(conv.id)}
                          className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-primary/10 border-l-2 border-primary'
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                            {conv.name.charAt(0)}
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground truncate">
                                {conv.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                {conv.time}
                              </span>
                            </div>

                            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                              {conv.lastMessage}
                            </p>

                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-foreground/80">
                                {conv.tag}
                              </span>
                              {conv.unread > 0 ? (
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                                  {conv.unread}
                                </span>
                              ) : (
                                <CheckCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Pane: Active Chat Conversation (7 cols on md) */}
                <div className="md:col-span-7 flex flex-col justify-between bg-card/40">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 bg-background/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                        {selectedConv.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate">
                            {selectedConv.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {selectedConv.phone}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Assigned to: {selectedConv.agent}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 p-0.5 cursor-pointer hover:text-foreground" />
                      <MoreVertical className="h-3.5 w-3.5 cursor-pointer hover:text-foreground" />
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 p-3.5 space-y-3 overflow-y-auto text-xs">
                    {/* Inbound Customer Message */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-muted p-3 text-foreground shadow-2xs">
                        <p className="leading-relaxed">
                          Hi! We are evaluating Resend for our 15 support agents. Can we broadcast Meta-approved templates and reply from a shared number?
                        </p>
                        <div className="mt-1 flex items-center justify-end text-[10px] text-muted-foreground">
                          10:24 AM
                        </div>
                      </div>
                    </div>

                    {/* Internal Collaboration Note (Private to Agents) */}
                    <div className="flex justify-center my-1">
                      <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-50/80 px-2.5 py-1 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span>Internal note: Enterprise tier verified (15 seats)</span>
                      </div>
                    </div>

                    {/* Outbound Agent Reply */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary text-primary-foreground p-3 shadow-2xs">
                        <p className="leading-relaxed">
                          Hello Sarah! Absolutely. With Resend, your entire team shares one WhatsApp number with concurrent agent logins, live routing, and dynamic template broadcasts.
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-primary-foreground/80">
                          <span>10:25 AM</span>
                          <CheckCheck className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    {/* Interactive Template Preview */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl border border-primary/30 bg-card p-3 shadow-xs">
                        <div className="flex items-center gap-1.5 text-primary text-[10px] font-semibold mb-1">
                          <FileText className="h-3 w-3" />
                          <span>Approved Meta Template: welcome_onboarding</span>
                        </div>
                        <p className="text-foreground leading-relaxed text-[11px]">
                          Your 14-day free trial workspace is ready. Click below to begin:
                        </p>
                        <div className="mt-2.5 flex flex-col gap-1.5">
                          <div className="rounded border border-primary/30 bg-primary/5 py-1 text-center font-medium text-primary text-[11px]">
                            👉 Open Team Workspace
                          </div>
                          <div className="rounded border border-border bg-muted/40 py-1 text-center font-medium text-foreground text-[11px]">
                            📖 View API Documentation
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          <span>10:26 AM</span>
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chat Input Bar */}
                  <div className="border-t border-border/70 p-2.5 bg-background/80 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Canned replies"
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Attach file"
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      readOnly
                      value="Type a reply or press '/' for canned templates..."
                      className="flex-1 bg-transparent text-xs text-muted-foreground outline-none"
                    />
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xs">
                      <Send className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Truthful Footer Caption */}
              <div className="border-t border-border/70 bg-muted/40 px-4 py-2 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Live Product Preview · Collaborative Multi-Agent Inbox</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
