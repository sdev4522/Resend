'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useInbox } from "@/lib/inbox/inbox-context";
import { inboxApi, PhonebookContact } from "@/lib/api/inbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  UserPlus,
  Phone,
  BookOpen,
  QrCode,
  Cloud,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export function NewChatDialog() {
  const {
    isNewChatOpen,
    setIsNewChatOpen,
    selectedAccount,
    selectConversation,
    startNewConversation,
  } = useInbox();

  const [activeTab, setActiveTab] = useState<string>("phonebook");

  // Phonebook state
  const [contacts, setContacts] = useState<PhonebookContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  const [searchContact, setSearchContact] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [checkingContactId, setCheckingContactId] = useState<number | null>(null);

  // Direct number state
  const [directPhone, setDirectPhone] = useState<string>("");
  const [directName, setDirectName] = useState<string>("");
  const [checkingDirect, setCheckingDirect] = useState<boolean>(false);

  // Fetch phonebook contacts
  const fetchContacts = useCallback(
    async (pageNum: number = 1, searchQuery: string = "") => {
      if (pageNum === 1) {
        setLoadingContacts(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await inboxApi.getPhonebookContacts({
          search: searchQuery.trim(),
          page: pageNum,
          limit: 25,
        });

        if (res && res.success && Array.isArray(res.data)) {
          if (pageNum === 1) {
            setContacts(res.data);
          } else {
            setContacts((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const filtered = res.data.filter((c) => !existingIds.has(c.id));
              return [...prev, ...filtered];
            });
          }
          setHasMore(!!res.hasMore);
          setPage(pageNum);
        }
      } catch (err) {
        console.error("Failed to load contacts:", err);
      } finally {
        setLoadingContacts(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Load contacts when dialog opens or activeTab switches to phonebook
  useEffect(() => {
    if (isNewChatOpen && activeTab === "phonebook") {
      fetchContacts(1, searchContact);
    }
  }, [isNewChatOpen, activeTab, fetchContacts]);

  // Debounced search for phonebook
  useEffect(() => {
    if (!isNewChatOpen || activeTab !== "phonebook") return;
    const timer = setTimeout(() => {
      fetchContacts(1, searchContact);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchContact, isNewChatOpen, activeTab, fetchContacts]);

  // Handle select contact from phonebook
  const handleSelectContact = async (contact: PhonebookContact) => {
    if (checkingContactId !== null) return;
    setCheckingContactId(contact.id);

    try {
      const res = await inboxApi.checkConversation({
        accountId: selectedAccount?.id !== "all" ? selectedAccount?.id : undefined,
        accountType: selectedAccount?.type !== "all" ? selectedAccount?.type : "qr",
        mobile: contact.mobile,
        name: contact.name,
      });

      if (res && res.success && res.chat) {
        if (res.exists) {
          selectConversation(res.chat);
          toast.success("Opened existing conversation with " + (contact.name || contact.mobile));
        } else {
          startNewConversation(res.chat);
          toast.info("Starting new conversation with " + (contact.name || contact.mobile));
        }
        setIsNewChatOpen(false);
      } else {
        toast.error("Unable to initialize chat with this contact");
      }
    } catch (err) {
      toast.error("Failed to check conversation status");
    } finally {
      setCheckingContactId(null);
    }
  };

  // Handle direct number chat
  const handleStartDirectChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = directPhone.replace(/[^0-9]/g, "");
    if (!cleanNumber || cleanNumber.length < 7) {
      toast.error("Please enter a valid phone number (at least 7 digits with country code)");
      return;
    }

    setCheckingDirect(true);
    try {
      const res = await inboxApi.checkConversation({
        accountId: selectedAccount?.id !== "all" ? selectedAccount?.id : undefined,
        accountType: selectedAccount?.type !== "all" ? selectedAccount?.type : "qr",
        mobile: cleanNumber,
        name: directName.trim() || undefined,
      });

      if (res && res.success && res.chat) {
        if (res.exists) {
          selectConversation(res.chat);
          toast.success("Opened existing conversation with +" + cleanNumber);
        } else {
          startNewConversation(res.chat);
          toast.info("Starting new conversation with +" + cleanNumber);
        }
        setIsNewChatOpen(false);
        setDirectPhone("");
        setDirectName("");
      } else {
        toast.error("Could not prepare conversation for this number");
      }
    } catch (err) {
      toast.error("Failed to check phone number");
    } finally {
      setCheckingDirect(false);
    }
  };

  return (
    <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <DialogHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>New Conversation</span>
            </DialogTitle>
          </div>

          {/* Sending From Account Banner */}
          <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg bg-background border text-xs">
            <span className="text-muted-foreground text-[11px]">Sending from:</span>
            <div className="flex items-center gap-1.5 font-medium truncate min-w-0">
              {selectedAccount?.type === "qr" ? (
                <QrCode className="h-3 w-3 text-emerald-600 shrink-0" />
              ) : selectedAccount?.type === "meta" ? (
                <Cloud className="h-3 w-3 text-blue-600 shrink-0" />
              ) : null}
              <span className="truncate">{selectedAccount?.title}</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 uppercase shrink-0">
                {selectedAccount?.type === "qr" ? "QR" : selectedAccount?.type === "meta" ? "Cloud API" : "ALL"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pt-3 pb-2 border-b bg-card">
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="phonebook" className="text-xs flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Phonebook</span>
              </TabsTrigger>
              <TabsTrigger value="direct" className="text-xs flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span>Direct Number</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Phonebook Picker Tab */}
          <TabsContent value="phonebook" className="m-0 p-0 focus-visible:outline-none">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchContact}
                  onChange={(e) => setSearchContact(e.target.value)}
                  placeholder="Search contact name or phone..."
                  className="h-8 pl-8 pr-7 text-xs bg-muted/40"
                  autoFocus
                />
                {searchContact && (
                  <button
                    onClick={() => setSearchContact("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
              {loadingContacts ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-1.5">
                  <BookOpen className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-foreground">No contacts found</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    {searchContact
                      ? "No phonebook contacts match your search."
                      : "Your contacts phonebook is currently empty."}
                  </p>
                </div>
              ) : (
                <>
                  {contacts.map((contact) => {
                    const isChecking = checkingContactId === contact.id;
                    const initials = (contact.name || contact.mobile || "?").slice(0, 2).toUpperCase();

                    return (
                      <div
                        key={contact.id}
                        onClick={() => handleSelectContact(contact)}
                        className={`p-3 flex items-center justify-between gap-3 hover:bg-muted/40 cursor-pointer transition-colors select-none ${
                          isChecking ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {contact.name || contact.mobile}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                              +{contact.mobile}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {contact.phonebook_name && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                              {contact.phonebook_name}
                            </span>
                          )}
                          {isChecking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && (
                    <div className="p-2.5 text-center bg-muted/10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchContacts(page + 1, searchContact)}
                        disabled={loadingMore}
                        className="h-7 text-xs text-primary"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                            Loading contacts...
                          </>
                        ) : (
                          "Load more contacts"
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* 2. Direct Number Tab */}
          <TabsContent value="direct" className="m-0 p-4 focus-visible:outline-none">
            <form onSubmit={handleStartDirectChat} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    value={directPhone}
                    onChange={(e) => setDirectPhone(e.target.value)}
                    placeholder="e.g. 919876543210 (include country code)"
                    className="h-9 text-xs pl-3 font-mono"
                    disabled={checkingDirect}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Enter full international format without + or spaces (e.g. 919876543210).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Contact Name (Optional)</label>
                <Input
                  value={directName}
                  onChange={(e) => setDirectName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-9 text-xs"
                  disabled={checkingDirect}
                />
              </div>

              <Button
                type="submit"
                disabled={!directPhone.trim() || checkingDirect}
                className="w-full h-9 text-xs font-medium gap-1.5 mt-2"
              >
                {checkingDirect ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Preparing conversation...</span>
                  </>
                ) : (
                  <>
                    <span>Start Conversation</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
