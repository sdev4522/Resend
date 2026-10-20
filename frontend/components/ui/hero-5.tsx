"use client";

import React, { type ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { Navigation5 } from "./navigation-5";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "../auth/auth-dialog-context";
import {
  ArrowRight,
  CheckCheck,
  Paperclip,
  Send,
  Lock,
  Search,
  MessageSquare,
  SendHorizontal,
  GitFork,
  Users,
  FileText,
} from "lucide-react";

export interface Hero5NavItem {
  label: string;
  href: string;
  hasDropdown?: boolean;
}

export interface Hero5Props {
  /** Brand logo icon */
  logo?: ReactNode;
  /** Brand logo text */
  logoText?: string;
  /** Navigation items */
  navItems?: Hero5NavItem[];
  /** Login button text */
  loginText?: string;
  /** Login button URL */
  loginHref?: string;
  /** Headline line 1 */
  titleLine1?: string;
  /** Headline line 2 */
  titleLine2Accent?: string;
  /** Body description paragraph */
  description?: string;
  /** Primary CTA text */
  primaryCtaText?: string;
  /** Primary CTA URL */
  primaryCtaHref?: string;
  /** Secondary CTA text */
  secondaryCtaText?: string;
  /** Secondary CTA URL */
  secondaryCtaHref?: string;
  /** Background image URL */
  backgroundImage?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export function Hero5({
  titleLine1 = "Get WhatsApp API",
  titleLine2Accent = "5 Minutes",
  description = "Connect your WhatsApp number with official Meta Cloud API or instant QR scan. Manage customer chats in a shared team inbox, broadcast verified template campaigns, and automate replies without technical complexity.",
  primaryCtaText = "Start Free Trial",
  secondaryCtaText = "View Pricing",
  secondaryCtaHref = "/#pricing",
  backgroundImage = "https://assets.watermelon.sh/hero-5-bg.avif",
}: Hero5Props) {
  const { openRegister } = useAuthDialog();

  return (
    <section className="relative w-full overflow-hidden bg-black pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24">
      {/* Background visual texture with black & red ambient identity */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            className="pointer-events-none h-full w-full object-cover select-none"
          />
        </div>
      )}

      {/* Subtle bottom gradient to blend naturally toward next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

      {/* Sticky/floating Glass Navigation Bar */}
      <Navigation5 />

      {/* Main Centered Hero Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8"
      >
        {/* Status Badge */}
        <motion.div variants={itemVariants} className="mb-4 sm:mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <span>WhatsApp Business API Platform</span>
          </div>
        </motion.div>

        {/* Primary Headline with Typographic Hierarchy */}
        <motion.h1 variants={itemVariants} className="max-w-4xl tracking-tight">
          <span className="block text-[1.65rem] xs:text-[1.95rem] sm:text-5xl md:text-6xl lg:text-[4.75rem] font-extrabold text-white leading-[1.1] sm:leading-[1.08]">
            {titleLine1}
          </span>
          <span className="mt-1.5 sm:mt-2 block text-xl xs:text-2xl sm:text-4xl md:text-5xl lg:text-[4.1rem] font-semibold text-zinc-300 leading-[1.15] sm:leading-[1.12]">
            In <span className="font-bold text-primary">{titleLine2Accent}.</span>
          </span>
        </motion.h1>

        {/* Concise Supporting Copy explaining verified WhatsApp SaaS capabilities */}
        {description && (
          <motion.p
            variants={itemVariants}
            className="mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base md:text-lg font-normal leading-relaxed text-zinc-300/90"
          >
            {description}
          </motion.p>
        )}

        {/* Closely Grouped CTA Actions */}
        <motion.div
          variants={itemVariants}
          className="mt-6 sm:mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          {primaryCtaText && (
            <Button
              size="lg"
              onClick={openRegister}
              className="group h-11 w-full cursor-pointer rounded-full px-7 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.98] sm:w-auto"
            >
              <span>{primaryCtaText}</span>
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Button>
          )}

          {secondaryCtaText && (
            <a
              href={secondaryCtaHref}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 text-sm font-medium text-white shadow-xs backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/10 sm:w-auto"
            >
              <span>{secondaryCtaText}</span>
            </a>
          )}
        </motion.div>

        {/* Minimal Trust Guarantee Pill */}
        <motion.div
          variants={itemVariants}
          className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-400"
        >
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            14-Day Free Trial
          </span>
          <span className="hidden sm:inline text-zinc-600">·</span>
          <span>No credit card required</span>
          <span className="hidden sm:inline text-zinc-600">·</span>
          <span>Meta Cloud API & QR Engine</span>
        </motion.div>

        {/* Prominent, Realistic Product Preview */}
        <motion.div
          variants={itemVariants}
          className="relative mt-8 sm:mt-10 w-full max-w-5xl rounded-2xl border border-zinc-800/90 bg-zinc-950/95 shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/10 text-left"
        >
          {/* macOS Desktop Chrome Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/70 px-3 py-2 sm:px-4 sm:py-2.5 text-xs select-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex gap-1.5 shrink-0">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="ml-2 hidden sm:inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                <Lock className="h-2.5 w-2.5 text-emerald-400" />
                resend.in/dashboard/inbox
              </span>
            </div>

            <span className="truncate px-2 text-[11px] font-medium text-zinc-300">
              <span className="hidden sm:inline">Acme Corp · </span>Multi-Agent Workspace
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 sm:px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
              <span className="hidden rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 sm:inline-block">
                Demo Preview
              </span>
            </div>
          </div>

          {/* Unified Workspace App Shell */}
          <div className="flex min-h-[380px] sm:min-h-[410px] bg-zinc-950 text-xs">
            {/* Leftmost Mini Navigation Rail */}
            <div className="hidden sm:flex w-14 shrink-0 flex-col items-center justify-between border-r border-zinc-800/80 bg-zinc-950/60 py-3.5">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shadow-xs">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-default">
                  <SendHorizontal className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-default">
                  <GitFork className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-default">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-default">
                  <FileText className="h-4 w-4" />
                </div>
              </div>

              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">
                AC
              </div>
            </div>

            {/* Conversation Queue Pane (visible on md+) */}
            <div className="hidden md:flex w-72 lg:w-80 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/40">
              <div className="border-b border-zinc-800/70 p-2.5">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    readOnly
                    value="Search conversations..."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 py-1 pl-8 pr-2.5 text-[11px] text-zinc-400 outline-none"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded bg-zinc-800/90 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                    All (18)
                  </span>
                  <span className="rounded px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    Assigned (4)
                  </span>
                  <span className="rounded px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    Unread (2)
                  </span>
                </div>
              </div>

              <div className="divide-y divide-zinc-800/50">
                {/* Active Chat Item */}
                <div className="border-l-2 border-primary bg-zinc-900/80 p-3 cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-100">Sarah Jenkins</span>
                    <span className="font-mono text-[10px] text-zinc-400">10:41 AM</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                    Does the team inbox support 10 concurrent agents?
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                      Agent: Elena R.
                    </span>
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                      1
                    </span>
                  </div>
                </div>

                {/* Second Chat Item */}
                <div className="p-3 hover:bg-zinc-900/30 transition-colors cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">David Kim</span>
                    <span className="font-mono text-[10px] text-zinc-500">10:24 AM</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    Automated tracking template triggered via webhook.
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] text-zinc-400">
                      Bot Auto
                    </span>
                    <CheckCheck className="h-3 w-3 text-emerald-400" />
                  </div>
                </div>

                {/* Third Chat Item */}
                <div className="p-3 hover:bg-zinc-900/30 transition-colors cursor-default">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">Priya Sharma</span>
                    <span className="font-mono text-[10px] text-zinc-500">9:50 AM</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    Order payment verified via Razorpay integration.
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] text-zinc-400">
                      Cloud API
                    </span>
                    <CheckCheck className="h-3 w-3 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Active Chat Thread Workspace */}
            <div className="flex flex-1 flex-col justify-between bg-zinc-950/80">
              {/* Thread Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/70 bg-zinc-900/40 px-3.5 py-2.5 sm:px-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    SJ
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-100">Sarah Jenkins</p>
                    <p className="font-mono text-[10px] text-zinc-500">+1 (415) 555-0198</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    Assigned: Elena R.
                  </span>
                  <span className="hidden sm:inline-block rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Meta Cloud API
                  </span>
                </div>
              </div>

              {/* Message Thread Body */}
              <div className="flex-1 space-y-3 p-3.5 sm:p-4 overflow-hidden">
                {/* Incoming Customer Message */}
                <div className="flex flex-col items-start">
                  <div className="max-w-[88%] sm:max-w-[80%] rounded-xl rounded-tl-none border border-zinc-800/80 bg-zinc-900/90 p-3 text-zinc-200 shadow-sm">
                    <p className="text-xs leading-relaxed">
                      Hi team, we&apos;re looking to connect WhatsApp for our 12 customer support agents. Does Resend support simultaneous logins without disconnecting?
                    </p>
                    <span className="mt-1 block text-right font-mono text-[9px] text-zinc-500">
                      10:41 AM
                    </span>
                  </div>
                </div>

                {/* Team Private Internal Note */}
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <span>
                    <strong className="font-semibold text-amber-300">Internal Note:</strong> Enterprise lead. Evaluating 12 agent seats and Cloud API throughput.
                  </span>
                </div>

                {/* Agent Reply */}
                <div className="flex flex-col items-end">
                  <div className="max-w-[88%] sm:max-w-[80%] rounded-xl rounded-tr-none bg-primary p-3 text-white shadow-sm">
                    <p className="text-xs leading-relaxed">
                      Hello Sarah! Yes, Resend provides simultaneous multi-agent collaboration with dedicated agent credentials and automated chat routing.
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[9px] text-white/80">
                      <span>10:42 AM</span>
                      <CheckCheck className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* Interactive WhatsApp Template Action Buttons */}
                <div className="flex flex-wrap justify-end gap-2 pt-0.5">
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                    [⚡ View Enterprise Pricing]
                  </span>
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                    [📅 Schedule Team Demo]
                  </span>
                </div>
              </div>

              {/* Bottom Message Composer */}
              <div className="border-t border-zinc-800/70 bg-zinc-900/40 p-2.5 sm:p-3">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <input
                    type="text"
                    readOnly
                    value="Type a verified template or reply..."
                    className="flex-1 bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-500"
                  />
                  <button
                    aria-label="Send message"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-xs transition-colors hover:bg-primary/90 cursor-default"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
