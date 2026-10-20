'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { useAuthDialog } from '@/components/auth/auth-dialog-context';
import {
  ArrowRight,
  CheckCheck,
  Send,
  Search,
  Lock,
  Paperclip,
} from 'lucide-react';

export function MarketingHero() {
  const { openRegister } = useAuthDialog();

  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-32">
      {/* Subtle ambient lighting without visual noise */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(0,168,132,0.07),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Headline, Value Proposition & Actions */}
          <div className="flex flex-col items-center text-center lg:col-span-5 lg:items-start lg:text-left">
            {/* Status Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3.5 py-1 text-xs font-medium text-foreground/80 mb-6 transition-colors">
              <span className="flex h-2 w-2 rounded-full bg-primary" />
              <span>Official WhatsApp Business API Platform</span>
            </div>

            {/* Primary Headline */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]">
              Get WhatsApp API in{' '}
              <span className="text-primary">5 Minutes</span>
            </h1>

            {/* Supporting Value Message */}
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Connect WhatsApp to your business, manage conversations, automate workflows, and send messages through a unified platform.
            </p>

            {/* Action CTAs */}
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row items-center">
              <Button
                size="lg"
                onClick={openRegister}
                className="h-11 px-7 rounded-lg text-sm font-semibold shadow-xs cursor-pointer w-full sm:w-auto"
              >
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                render={<Link href="/#features" />}
                className="h-11 px-6 rounded-lg text-sm font-medium text-foreground hover:bg-muted cursor-pointer w-full sm:w-auto"
              >
                Explore Features
              </Button>
            </div>

            {/* Trust and Key Capabilities List */}
            <div className="mt-10 grid grid-cols-3 gap-4 w-full pt-6 border-t border-border/50 text-left">
              <div>
                <p className="text-xs font-semibold text-foreground">14-Day Trial</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Full feature access</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Zero Friction</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No credit card needed</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Dual Engine</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Meta API + QR code</p>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Multi-Agent Inbox Product Preview */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative mx-auto w-full max-w-2xl rounded-xl border border-border/80 bg-card shadow-xl overflow-hidden"
            >
              {/* Desktop Window Titlebar */}
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-border" />
                    <div className="h-2.5 w-2.5 rounded-full bg-border" />
                    <div className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    resend.in/dashboard/inbox
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Meta Cloud API · Connected
                  </span>
                </div>
              </div>

              {/* 2-Pane WhatsApp Collaborative Inbox Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-background text-xs">
                {/* Left Pane: Conversation Queue (5 cols on md) */}
                <div className="md:col-span-5 border-r border-border/70 flex flex-col bg-muted/10">
                  <div className="p-2.5 border-b border-border/60">
                    <div className="relative flex items-center">
                      <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        readOnly
                        value="Search conversations..."
                        className="w-full rounded-md border border-border/60 bg-background pl-8 pr-2.5 py-1 text-[11px] text-muted-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-border/40">
                    {/* Item 1 - Active Conversation */}
                    <div className="p-3 bg-primary/5 border-l-2 border-primary cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Sarah Jenkins</span>
                        <span className="text-[10px] text-muted-foreground font-mono">10:41 AM</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        Does the team inbox support 10 concurrent agents?
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          Agent: Elena R.
                        </span>
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                          1
                        </span>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Marcus Cole</span>
                        <span className="text-[10px] text-muted-foreground font-mono">10:24 AM</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        Broadcast campaign scheduled for 10,000 contacts.
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          Campaign Lead
                        </span>
                        <CheckCheck className="h-3 w-3 text-primary" />
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Elena Rostova</span>
                        <span className="text-[10px] text-muted-foreground font-mono">9:45 AM</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        Template welcome_promo approved by Meta.
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          Meta Verified
                        </span>
                        <CheckCheck className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Active Conversation Thread (7 cols on md) */}
                <div className="md:col-span-7 flex flex-col justify-between bg-card">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 bg-muted/20">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                        SJ
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Sarah Jenkins</p>
                        <p className="text-[10px] text-muted-foreground font-mono">+1 (415) 555-0198</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Assigned: Elena R.
                      </span>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                    {/* Customer Message */}
                    <div className="flex flex-col items-start">
                      <div className="max-w-[85%] rounded-lg rounded-tl-none bg-muted p-3 text-foreground shadow-2xs">
                        <p className="text-xs leading-relaxed">
                          Hi team, we&apos;re looking to connect WhatsApp for our 12 customer support agents. Does Resend support simultaneous logins without disconnecting?
                        </p>
                        <span className="mt-1 block text-right text-[9px] text-muted-foreground">
                          10:41 AM
                        </span>
                      </div>
                    </div>

                    {/* Private Internal Team Note */}
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                      <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <span>
                        <strong className="font-semibold">Internal Note:</strong> Verified enterprise lead. Looking for 12 agent seats and Cloud API throughput.
                      </span>
                    </div>

                    {/* Agent Response */}
                    <div className="flex flex-col items-end">
                      <div className="max-w-[85%] rounded-lg rounded-tr-none bg-primary p-3 text-primary-foreground shadow-2xs">
                        <p className="text-xs leading-relaxed">
                          Hello Sarah! Yes, Resend provides simultaneous multi-agent collaboration with dedicated agent credentials and automated chat routing.
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-primary-foreground/80">
                          <span>10:42 AM</span>
                          <CheckCheck className="h-3 w-3" />
                        </div>
                      </div>
                    </div>

                    {/* Interactive Template Button Previews */}
                    <div className="flex flex-wrap gap-2 pt-1 justify-end">
                      <span className="rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                        [⚡ View Enterprise Pricing]
                      </span>
                      <span className="rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                        [📅 Schedule Team Demo]
                      </span>
                    </div>
                  </div>

                  {/* Message Composer Bar */}
                  <div className="border-t border-border/70 p-2.5 bg-background">
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        readOnly
                        value="Type a verified template or reply..."
                        className="flex-1 bg-transparent text-xs text-muted-foreground outline-none"
                      />
                      <button className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground shrink-0 cursor-pointer">
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
