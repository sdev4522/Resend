'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  CirclePlay,
  CheckCircle2,
  Sparkles,
  Zap,
  Send,
  CheckCheck,
} from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';

export function MarketingHero() {
  const { openRegister, openLogin } = useAuthDialog();

  return (
    <div className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto overflow-hidden">
      {/* Background glow effects */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 blur-[120px] rounded-full -z-10"
        aria-hidden="true"
      />

      {/* Top Tag & Main Messaging */}
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        <Badge
          variant="outline"
          className="bg-primary/10 border-primary/25 text-primary text-xs font-semibold py-1.5 px-4 rounded-full mb-6 gap-1.5 shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Official Meta WhatsApp Cloud API & Multi-Agent CRM
        </Badge>

        <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground !leading-[1.12]">
          Unify Your Entire Team on{' '}
          <span className="text-primary underline decoration-primary/30 decoration-wavy decoration-2 underline-offset-8">
            WhatsApp
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
          Manage customer support conversations with a shared team inbox, run targeted broadcast campaigns, and automate customer journeys with no-code chatbots.
        </p>

        {/* CTA Buttons */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
          <Button
            size="lg"
            className="w-full sm:w-auto rounded-full text-sm sm:text-base h-12 px-8 font-semibold gap-2 shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={openRegister}
          >
            Start 10-Day Free Trial <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-full text-sm sm:text-base h-12 px-8 font-medium gap-2 border-border/80 hover:bg-muted/50 cursor-pointer"
            onClick={openLogin}
          >
            <CirclePlay className="h-4 w-4 text-primary" /> Sign In to Workspace
          </Button>
        </div>

        {/* Real Product Value Highlights */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Official Meta Graph API</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Multi-Agent Inbox Assignment</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Visual No-Code Flow Builder</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Authoritative Billing &amp; Invoicing</span>
          </div>
        </div>
      </div>

      {/* Real Product UI Mockup / Showcase Frame */}
      <div className="mt-14 sm:mt-18 relative mx-auto max-w-5xl rounded-2xl border border-border/80 bg-card/80 p-2 sm:p-3 shadow-2xl shadow-primary/5 transition-all">
        {/* Browser / App Header Bar */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 bg-muted/40 rounded-t-xl text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 font-mono text-[11px] text-foreground/80 font-medium hidden sm:inline">
              resend.in/dashboard/inbox
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground font-medium">WhatsApp Cloud API • Connected</span>
          </div>
        </div>

        {/* Inbox Interface Mockup */}
        <div className="grid grid-cols-1 md:grid-cols-12 bg-background/90 rounded-b-xl overflow-hidden min-h-[380px] sm:min-h-[420px] text-xs">
          {/* Left Chat List Column */}
          <div className="hidden md:flex md:col-span-4 border-r border-border/60 flex-col bg-card/30">
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Conversations
              </span>
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                3 active
              </Badge>
            </div>

            <div className="divide-y divide-border/30">
              <div className="p-3 bg-accent/40 border-l-2 border-primary">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Sarah Jenkins</span>
                  <span className="text-[10px] text-muted-foreground">Just now</span>
                </div>
                <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                  Can we connect multiple WhatsApp numbers?
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">
                    VIP Inquiry
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Assigned: Alex C.</span>
                </div>
              </div>

              <div className="p-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Liam Davis</span>
                  <span className="text-[10px] text-muted-foreground">12m ago</span>
                </div>
                <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                  Payment confirmation received. Thank you!
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-400">
                    Paid Order
                  </Badge>
                </div>
              </div>

              <div className="p-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Devon Miles</span>
                  <span className="text-[10px] text-muted-foreground">1h ago</span>
                </div>
                <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                  Webhook payload signature verified.
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    Developer API
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Center Chat Thread */}
          <div className="col-span-1 md:col-span-8 flex flex-col justify-between p-4 sm:p-5 bg-card/10">
            {/* Conversation Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                  SJ
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">Sarah Jenkins</h4>
                  <p className="text-[11px] text-muted-foreground">+1 (415) 892-0192 • Acme Enterprise</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                Resolved by Cloud API
              </Badge>
            </div>

            {/* Chat Bubble Messages */}
            <div className="space-y-3.5 my-4">
              {/* Inbound Customer */}
              <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
                <div className="rounded-2xl rounded-tl-sm bg-muted/60 border border-border/60 p-3 text-foreground text-xs leading-relaxed">
                  Hi! Can our support agents respond simultaneously from one official WhatsApp number?
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 ml-1">10:42 AM</span>
              </div>

              {/* Outbound Agent */}
              <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%] ml-auto">
                <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground p-3 text-xs leading-relaxed shadow-sm">
                  Yes, exactly! With Resend, your entire team shares verified numbers with live assignment, internal notes, and automated routing rules.
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 mr-1">
                  <span>10:43 AM</span>
                  <CheckCheck className="h-3 w-3 text-primary" />
                </div>
              </div>

              {/* Bot Interactive Quick Reply */}
              <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                  <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Automated Flow Response
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-medium text-foreground">
                      Schedule Product Demo
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-medium text-foreground">
                      View Documentation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Composer Footer Mockup */}
            <div className="flex items-center gap-2 pt-3 border-t border-border/40">
              <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground text-xs">
                Type a message or &apos;/&apos; to use templates...
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Send className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
