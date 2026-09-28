'use client';

import React from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  QrCode,
  Cloud,
  Clock,
  PanelRight,
  PanelRightClose,
} from "lucide-react";

export function ConversationHeader() {
  const {
    selectedConversation,
    selectedAccount,
    selectedContact,
    showContactPanel,
    setShowContactPanel,
    setIsMobileChatOpen,
    countDownTimer,
  } = useInbox();

  if (!selectedConversation) return null;

  const contactName =
    selectedContact?.name ||
    (selectedConversation.sender_name && selectedConversation.sender_name !== "NA"
      ? selectedConversation.sender_name
      : selectedConversation.sender_mobile);

  const contactPhone =
    selectedContact?.mobile || selectedConversation.sender_mobile;

  const isQr = selectedConversation.origin === "qr";

  return (
    <div className="h-14 px-4 border-b bg-card flex items-center justify-between gap-3 shrink-0">
      {/* Left: Mobile Back + Contact Info */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileChatOpen(false)}
          className="h-9 w-9 md:hidden shrink-0 touch-manipulation"
          aria-label="Back to conversations list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
          {(contactName || "?").slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h3 className="text-xs font-bold text-foreground truncate">{contactName}</h3>
            <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 font-mono shrink-0">
              {isQr ? "WhatsApp QR" : "Meta API"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono truncate leading-none mt-0.5">
            {contactPhone}
          </p>
        </div>
      </div>

      {/* Right: Sending Account Indicator & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Active Sending Account Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-muted/30 text-[11px] font-mono">
          <span className="text-muted-foreground text-[10px]">Sending via:</span>
          <span className="font-semibold text-foreground flex items-center gap-1">
            {isQr ? (
              <QrCode className="h-3 w-3 text-emerald-600" />
            ) : (
              <Cloud className="h-3 w-3 text-blue-600" />
            )}
            <span>{selectedAccount?.title || (isQr ? "WhatsApp Web" : "Meta API")}</span>
          </span>
        </div>

        {/* 24-hr Window status if available */}
        {countDownTimer && countDownTimer.timestamp && (
          <div
            className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono"
            title="Active 24-hour customer messaging window"
          >
            <Clock className="h-3 w-3" />
            <span>24h Window Active</span>
          </div>
        )}

        {/* Toggle Contact Panel */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowContactPanel(!showContactPanel)}
          className="h-9 w-9 text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label="Toggle contact details"
          title="Toggle contact details"
        >
          {showContactPanel ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
