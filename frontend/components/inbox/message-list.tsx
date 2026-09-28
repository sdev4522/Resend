'use client';

import React, { useEffect, useRef, useState } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Download,
  ArrowDown,
  RotateCw,
} from "lucide-react";

function formatMessageTime(ts?: string | number): string {
  if (!ts) return "";
  try {
    let d: Date;
    if (typeof ts === "number") {
      d = new Date(ts > 1e11 ? ts : ts * 1000);
    } else {
      const num = Number(ts);
      if (!isNaN(num) && num > 0) {
        d = new Date(num > 1e11 ? num : num * 1000);
      } else {
        d = new Date(ts);
      }
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateSeparator(ts?: string | number): string {
  if (!ts) return "";
  try {
    let d: Date;
    if (typeof ts === "number") {
      d = new Date(ts > 1e11 ? ts : ts * 1000);
    } else {
      const num = Number(ts);
      if (!isNaN(num) && num > 0) {
        d = new Date(num > 1e11 ? num : num * 1000);
      } else {
        d = new Date(ts);
      }
    }
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}


function resolveMediaUrl(link?: string): string {
  if (!link) return "";
  const trimmed = link.trim();
  if (!trimmed) return "";

  const apiBase = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "http://localhost:3001";

  if (trimmed.includes(":3000/meta-media/") || trimmed.includes(":3000/media/")) {
    return trimmed.replace(/http:\/\/[^/]+:3000/, apiBase);
  }

  if (trimmed.startsWith("/meta-media/") || trimmed.startsWith("/media/")) {
    return `${apiBase}${trimmed}`;
  }

  return trimmed;
}

export function MessageList() {
  const { messages, loadingMessages, selectedConversation, sendTextMessage } = useInbox();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Auto-scroll on initial load or new outgoing message
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loadingMessages, messages.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loadingMessages) {
    return (
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
          >
            <Skeleton className={`h-12 ${i % 2 === 0 ? "w-48" : "w-64"} rounded-2xl`} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">No messages yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          Send a WhatsApp message or select a template to start the conversation with{" "}
          <span className="font-semibold text-foreground">
            {selectedConversation?.sender_name || selectedConversation?.sender_mobile}
          </span>
          .
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3 relative bg-background/50"
    >
      {messages.map((msg, idx) => {
        const isOutgoing = msg.route === "OUTGOING" || msg.sentBy === "user" || msg.sentBy === "template";
        const prevMsg = idx > 0 ? messages[idx - 1] : null;
        const currentDateStr = formatDateSeparator(msg.timestamp);
        const prevDateStr = prevMsg ? formatDateSeparator(prevMsg.timestamp) : null;
        const showDateSeparator = currentDateStr !== prevDateStr;

        const ctx = msg.msgContext;
        const timeFormatted = formatMessageTime(msg.timestamp);

        return (
          <React.Fragment key={msg.metaChatId || msg.id || idx}>
            {showDateSeparator && (
              <div className="flex justify-center my-3">
                <span className="px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[10px] font-mono shadow-2xs">
                  {currentDateStr}
                </span>
              </div>
            )}

            <div className={`flex items-end gap-1.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-2xs relative text-xs break-words ${
                  isOutgoing
                    ? "bg-primary text-primary-foreground rounded-br-xs"
                    : "bg-card border text-card-foreground rounded-bl-xs"
                }`}
              >
                {/* 1. TEXT MESSAGE */}
                {(msg.type === "text" || !msg.type) && (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {ctx?.text?.body || (typeof ctx === "string" ? ctx : "Message")}
                  </p>
                )}

                {/* 2. IMAGE MESSAGE */}
                {msg.type === "image" && (
                  <div className="space-y-1.5">
                    {ctx?.image?.link ? (
                      (() => {
                        const resolvedUrl = resolveMediaUrl(ctx.image.link);
                        const isFailed = imageErrors[resolvedUrl];
                        if (isFailed) {
                          return (
                            <div className="p-3 rounded-lg bg-black/10 dark:bg-white/10 text-center space-y-1">
                              <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium">
                                <FileText className="h-4 w-4" />
                                <span>Image Attachment</span>
                              </div>
                              <a
                                href={resolvedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] underline hover:opacity-80"
                              >
                                <Download className="h-3 w-3" /> View or download
                              </a>
                            </div>
                          );
                        }
                        return (
                          <a
                            href={resolvedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg bg-black/5 dark:bg-white/5 relative min-h-[140px] max-w-[280px]"
                          >
                            <img
                              src={resolvedUrl}
                              alt="Attachment"
                              loading="lazy"
                              decoding="async"
                              width={280}
                              height={180}
                              onError={() => setImageErrors((prev) => ({ ...prev, [resolvedUrl]: true }))}
                              className="max-h-60 rounded-lg object-contain w-full hover:opacity-95 transition-opacity"
                            />
                          </a>
                        );
                      })()
                    ) : (
                      <div className="p-4 rounded-lg bg-muted text-center text-[11px] text-muted-foreground">
                        📷 Image file
                      </div>
                    )}
                    {ctx?.image?.caption && (
                      <p className="whitespace-pre-wrap mt-1 leading-relaxed">{ctx.image.caption}</p>
                    )}
                  </div>
                )}

                {/* 3. VIDEO MESSAGE */}
                {msg.type === "video" && (
                  <div className="space-y-1.5">
                    {ctx?.video?.link ? (
                      <video
                        src={resolveMediaUrl(ctx.video.link)}
                        controls
                        preload="metadata"
                        playsInline
                        className="max-h-60 rounded-lg w-full bg-black/20"
                      />
                    ) : (
                      <div className="p-4 rounded-lg bg-muted text-center text-[11px] text-muted-foreground">
                        🎥 Video file
                      </div>
                    )}
                    {ctx?.video?.caption && (
                      <p className="whitespace-pre-wrap mt-1 leading-relaxed">{ctx.video.caption}</p>
                    )}
                  </div>
                )}

                {/* 4. AUDIO MESSAGE */}
                {msg.type === "audio" && (
                  <div className="py-1">
                    {ctx?.audio?.link ? (
                      <audio controls preload="metadata" src={resolveMediaUrl(ctx.audio.link)} className="max-w-[240px] h-8" />
                    ) : (
                      <p className="text-[11px] italic">🎵 Voice note</p>
                    )}
                  </div>
                )}

                {/* 5. DOCUMENT MESSAGE */}
                {msg.type === "document" && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10">
                      <FileText className="h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-[11px]">
                          {ctx?.document?.filename || "Document"}
                        </p>
                      </div>
                      {ctx?.document?.link && (
                        <a
                          href={resolveMediaUrl(ctx.document.link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="p-1 rounded hover:bg-black/15 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {ctx?.document?.caption && (
                      <p className="whitespace-pre-wrap mt-1 leading-relaxed">{ctx.document.caption}</p>
                    )}
                  </div>
                )}

                {/* 6. TEMPLATE / BUTTON MESSAGE */}
                {(msg.type === "template" || msg.type === "button") && (
                  <div className="space-y-1.5">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {ctx?.template?.text || ctx?.interactive?.body?.text || "Template message"}
                    </p>
                  </div>
                )}

                {/* Timestamp & Status Footer */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[9px] font-mono ${
                    isOutgoing ? "text-primary-foreground/75" : "text-muted-foreground"
                  }`}
                >
                  <span>{timeFormatted}</span>

                  {isOutgoing && (
                    <>
                      {msg.isFailed ? (
                        <span className="text-red-300 flex items-center gap-0.5 font-bold" title="Failed to send">
                          <AlertCircle className="h-3 w-3" />
                          <button
                            onClick={() => sendTextMessage(ctx?.text?.body || "")}
                            className="underline hover:text-white ml-1 flex items-center gap-0.5"
                          >
                            <RotateCw className="h-2.5 w-2.5" /> Retry
                          </button>
                        </span>
                      ) : msg.isOptimistic || msg.status === "sending" ? (
                        <span title="Sending..."><Clock className="h-2.5 w-2.5 animate-spin" /></span>
                      ) : msg.status === "read" ? (
                        <span title="Read"><CheckCheck className="h-3 w-3 text-sky-300" /></span>
                      ) : msg.status === "delivered" ? (
                        <span title="Delivered"><CheckCheck className="h-3 w-3" /></span>
                      ) : (
                        <span title="Sent"><Check className="h-3 w-3" /></span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <div ref={bottomRef} />

      {/* Floating Scroll to Bottom button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 z-10 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center gap-1 text-xs"
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-[10px] font-bold pr-1">Latest</span>
        </button>
      )}
    </div>
  );
}
