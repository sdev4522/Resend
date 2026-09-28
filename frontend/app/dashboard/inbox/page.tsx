'use client';

import React from "react";
import { InboxProvider, useInbox } from "@/lib/inbox/inbox-context";
import { AccountSelector } from "@/components/inbox/account-selector";
import { ChatListPanel } from "@/components/inbox/chat-list-panel";
import { ConversationHeader } from "@/components/inbox/conversation-header";
import { MessageList } from "@/components/inbox/message-list";
import { MessageComposer } from "@/components/inbox/message-composer";
import { ContactDetailPanel } from "@/components/inbox/contact-detail-panel";
import { MessageSquare, QrCode, Cloud } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

function InboxMainView() {
  const { selectedConversation, isMobileChatOpen, showContactPanel, setShowContactPanel } = useInbox();

  return (
    <>
      <div className="h-[calc(100dvh-5.25rem)] sm:h-[calc(100dvh-6.5rem)] -m-3.5 sm:m-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-y sm:border overflow-hidden bg-card shadow-xs flex">
        {/* Column 1: Accounts & Chat List (320px on desktop; full screen on mobile when chat not open) */}
        <div
          className={`w-full md:w-[320px] lg:w-[340px] h-full flex flex-col shrink-0 ${
            isMobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <AccountSelector />
          <ChatListPanel />
        </div>

        {/* Column 2: Active Conversation (Flex-1) */}
        <div
          className={`flex-1 h-full flex flex-col min-w-0 ${
            !isMobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConversation ? (
            <>
              <ConversationHeader />
              <MessageList />
              <MessageComposer />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none bg-muted/10">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-2xs">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-foreground">WhatsApp Operational Inbox</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Select a conversation from the sidebar or choose an active WhatsApp line to start messaging contacts in real-time.
              </p>

              <div className="flex items-center gap-3 pt-6 text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-background shadow-2xs">
                  <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp Web (QR)</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-background shadow-2xs">
                  <Cloud className="h-3.5 w-3.5 text-blue-600" />
                  <span>Meta Cloud API</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Contact Details (Desktop Inline Panel) */}
        <div className="hidden lg:flex h-full shrink-0">
          <ContactDetailPanel />
        </div>
      </div>

      {/* Mobile & Tablet Drawer / Sheet for Contact Details */}
      <Sheet open={showContactPanel} onOpenChange={setShowContactPanel}>
        <SheetContent side="right" className="p-0 w-[88vw] sm:max-w-sm lg:hidden border-l">
          <SheetTitle className="sr-only">Contact Details</SheetTitle>
          <ContactDetailPanel isMobileSheet />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function InboxPage() {
  return (
    <InboxProvider>
      <div className="space-y-4">
        <InboxMainView />
      </div>
    </InboxProvider>
  );
}
