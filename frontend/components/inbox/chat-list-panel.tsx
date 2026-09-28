'use client';

import React, { useRef } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewChatDialog } from "@/components/inbox/new-chat-dialog";
import {
  Search,
  X,
  MessageSquare,
  StickyNote,
  QrCode,
  Cloud,
  Plus,
  Loader2,
  Check,
  CheckCheck,
  Clock,
} from "lucide-react";

function extractLastMessageText(lastMsg: any): string {
  if (!lastMsg) return "No messages yet";
  if (typeof lastMsg === "string") {
    try {
      lastMsg = JSON.parse(lastMsg);
    } catch {
      return lastMsg;
    }
  }

  const type = lastMsg.type;
  const ctx = lastMsg.msgContext;

  switch (type) {
    case "text":
      return ctx?.text?.body || "Text message";
    case "image":
      return "📷 Photo" + (ctx?.image?.caption ? ": " + ctx.image.caption : "");
    case "video":
      return "🎥 Video" + (ctx?.video?.caption ? ": " + ctx.video.caption : "");
    case "audio":
      return "🎵 Voice note";
    case "document":
      return "📄 Document: " + (ctx?.document?.filename || "File");
    case "location":
      return "📍 Location";
    case "contact":
      return "👤 Contact card";
    case "template":
      return "📋 " + (ctx?.template?.text || "Template message");
    case "button":
      return "🔘 " + (ctx?.interactive?.body?.text || "Button");
    default:
      return ctx?.text?.body || "Message";
  }
}

function formatChatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();

    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function ChatListPanel() {
  const {
    chats,
    loadingChats,
    hasMoreChats,
    loadingMoreChats,
    loadMoreChats,
    searchQuery,
    setSearchQuery,
    filterTab,
    setFilterTab,
    selectedConversation,
    selectConversation,
    setIsNewChatOpen,
  } = useInbox();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (hasMoreChats && !loadingMoreChats) {
        loadMoreChats();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Header with Title and New Chat (+) Button */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Chats</span>
          {chats.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono text-muted-foreground">
              {chats.length}
            </span>
          )}
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsNewChatOpen(true)}
          className="h-7 px-2.5 text-xs gap-1 shadow-2xs font-medium cursor-pointer"
          title="New Chat"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Search and Filter Pills */}
      <div className="p-3 pt-2 border-b space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, message..."
            className="h-8 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              filterTab === "all"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterTab("unread")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              filterTab === "unread"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            <span>Unread</span>
          </button>
          <button
            onClick={() => setFilterTab("has_note")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              filterTab === "has_note"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            <StickyNote className="h-2.5 w-2.5" />
            <span>Notes</span>
          </button>
        </div>
      </div>

      {/* Chat List Body */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto divide-y divide-border/40"
      >
        {loadingChats ? (
          <div className="p-3 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">No conversations</p>
              <p className="text-[11px] text-muted-foreground max-w-[200px]">
                {searchQuery
                  ? "No chats matched your search."
                  : "Start a new chat from your phonebook or direct number."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsNewChatOpen(true)}
              className="h-8 text-xs gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </Button>
          </div>
        ) : (
          <>
            {chats.map((chat) => {
              const isSelected = selectedConversation?.chat_id === chat.chat_id;
              const lastMsgPreview = extractLastMessageText(chat.last_message);
              const timeFormatted = formatChatTime(chat.updatedAt || chat.createdAt);
              const hasUnread = (chat.unread_count || 0) > 0;

              let parsedTags: any[] = [];
              try {
                if (chat.chat_label) {
                  parsedTags = typeof chat.chat_label === "string" ? JSON.parse(chat.chat_label) : chat.chat_label;
                }
              } catch {}

              return (
                <div
                  key={chat.chat_id}
                  onClick={() => selectConversation(chat)}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-3 select-none relative ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-l-primary"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/25 text-primary flex items-center justify-center font-bold text-xs">
                      {(chat.sender_name || chat.sender_mobile || "?").slice(0, 2).toUpperCase()}
                    </div>
                    {/* Origin Channel Pill */}
                    <span
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border flex items-center justify-center shadow-2xs text-[9px]"
                      title={chat.origin === "qr" ? "WhatsApp Web (QR)" : "Meta Cloud API"}
                    >
                      {chat.origin === "qr" ? (
                        <QrCode className="h-2.5 w-2.5 text-emerald-600" />
                      ) : (
                        <Cloud className="h-2.5 w-2.5 text-blue-600" />
                      )}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs truncate ${
                          hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                        }`}
                      >
                        {chat.sender_name && chat.sender_name !== "NA"
                          ? chat.sender_name
                          : chat.sender_mobile}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {timeFormatted}
                      </span>
                    </div>

                    {(() => {
                      const isOutgoing = chat.last_message?.route === "OUTGOING" || chat.last_message?.sentBy === "user" || chat.last_message?.sentBy === "template";
                      const msgStatus = chat.last_message?.status?.toLowerCase();
                      return (
                        <p
                          className={`text-[11px] truncate leading-tight flex items-center ${
                            hasUnread
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isOutgoing && (
                            msgStatus === "read" ? (
                              <CheckCheck className="h-3 w-3 mr-1 text-sky-500 shrink-0 inline" />
                            ) : msgStatus === "delivered" ? (
                              <CheckCheck className="h-3 w-3 mr-1 text-muted-foreground shrink-0 inline" />
                            ) : msgStatus === "sending" || msgStatus === "pending" ? (
                              <Clock className="h-2.5 w-2.5 mr-1 text-muted-foreground shrink-0 inline" />
                            ) : (
                              <Check className="h-3 w-3 mr-1 text-muted-foreground shrink-0 inline" />
                            )
                          )}
                          <span className="truncate">{lastMsgPreview}</span>
                        </p>
                      );
                    })()}

                    {/* Badges / Tags Footer */}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-1 overflow-hidden flex-wrap max-h-4">
                        {Array.isArray(parsedTags) &&
                          parsedTags.slice(0, 2).map((t: any, idx: number) => (
                            <span
                              key={idx}
                              className="text-[9px] px-1 py-0 rounded bg-muted/60 text-muted-foreground font-mono truncate"
                            >
                              {t.title || t}
                            </span>
                          ))}
                      </div>

                      {hasUnread && (
                        <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold font-mono shrink-0">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom Infinite Scroll Loader */}
            {loadingMoreChats && (
              <div className="p-3 text-center flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/10">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Loading more conversations...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog />
    </div>
  );
}
