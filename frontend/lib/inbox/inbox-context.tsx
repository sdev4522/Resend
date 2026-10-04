"use client";

const STATUS_RANK: Record<string, number> = {
  sending: 1,
  pending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { inboxApi } from "@/lib/api/inbox";
import { toast } from "sonner";
import {
  InboxAccount,
  ChatItem,
  ConversationMessage,
  ChatContactData,
  CountDownTimer,
  ChatTagItem,
} from "@/types/inbox";

interface InboxContextType {
  // Accounts
  accounts: InboxAccount[];
  selectedAccount: InboxAccount | null;
  setSelectedAccount: (acc: InboxAccount) => void;
  refreshAccounts: () => Promise<void>;

  // Chat List
  chats: ChatItem[];
  loadingChats: boolean;
  hasMoreChats: boolean;
  loadingMoreChats: boolean;
  loadMoreChats: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterTab: "all" | "unread" | "has_note";
  setFilterTab: (tab: "all" | "unread" | "has_note") => void;
  refreshChats: () => Promise<void>;

  // Selected Conversation
  selectedConversation: ChatItem | null;
  selectConversation: (chat: ChatItem | null) => void;
  startNewConversation: (chat: ChatItem) => void;
  selectedContact: ChatContactData | null;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  messages: ConversationMessage[];
  countDownTimer: CountDownTimer | null;
  availableTags: ChatTagItem[];

  // Actions
  sendTextMessage: (text: string) => Promise<boolean>;
  sendMediaMessage: (file: File, caption?: string) => Promise<boolean>;
  sendMetaTemplate: (
    templateName: string,
    templateBody: string,
    language?: string,
    variables?: Record<string, string> | any[],
    components?: any[]
  ) => Promise<boolean>;
  addTagToChat: (tagTitle: string) => Promise<void>;
  removeTagFromChat: (tagTitle: string) => Promise<void>;
  addNoteToChat: (noteText: string) => Promise<void>;
  deleteNoteFromChat: (noteId: string) => Promise<void>;
  markChatAsRead: () => void;

  // UI state
  showContactPanel: boolean;
  setShowContactPanel: (show: boolean) => void;
  isMobileChatOpen: boolean;
  setIsMobileChatOpen: (open: boolean) => void;
  isNewChatOpen: boolean;
  setIsNewChatOpen: (open: boolean) => void;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { socket, isConnected } = useSocket();

  // Accounts state
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<InboxAccount | null>(null);

  // Chat list state
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(true);
  const [hasMoreChats, setHasMoreChats] = useState<boolean>(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "has_note">("all");

  // Conversation state
  const [selectedConversation, setSelectedConversation] = useState<ChatItem | null>(null);
  const [selectedContact, setSelectedContact] = useState<ChatContactData | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState<boolean>(false);
  const [countDownTimer, setCountDownTimer] = useState<CountDownTimer | null>(null);
  const [availableTags, setAvailableTags] = useState<ChatTagItem[]>([]);

  // UI State
  const [showContactPanel, setShowContactPanel] = useState<boolean>(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);

  // Active refs to eliminate closure stale-data issues
  const selectedConversationRef = useRef<ChatItem | null>(null);
  const selectedAccountRef = useRef<InboxAccount | null>(null);
  const chatsRef = useRef<ChatItem[]>([]);
  const messagesRef = useRef<ConversationMessage[]>([]);

  // Account-scoped conversation cache
  const accountChatCache = useRef<Record<string, { chats: ChatItem[]; hasMore: boolean }>>({});
  const conversationMsgCache = useRef<Record<string, { messages: ConversationMessage[]; hasMore: boolean }>>({});

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 1. Fetch available accounts (QR + Meta)
  const refreshAccounts = useCallback(async () => {
    try {
      const accList: InboxAccount[] = [
        {
          id: "all",
          type: "all",
          title: "All Connections",
          number: "Unified Inbox",
          status: "ACTIVE",
          isConnected: true,
        },
      ];

      // Fetch QR instances
      try {
        const qrRes = await inboxApi.getQrInstances();
        if (qrRes && qrRes.success && Array.isArray(qrRes.data)) {
          qrRes.data.forEach((inst: any) => {
            accList.push({
              id: inst.uniqueId || String(inst.id),
              type: "qr",
              title: inst.qr_title || (inst.number ? "WhatsApp (" + inst.number + ")" : "QR Account"),
              number: inst.number || "Not Paired",
              status: inst.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
              isConnected: inst.status === "ACTIVE",
              instanceData: inst,
            });
          });
        }
      } catch (err) {
        console.warn("Failed to load QR accounts:", err);
      }

      // Fetch Meta API keys
      try {
        const metaRes = await inboxApi.getMetaKeys();
        if (metaRes && metaRes.success && metaRes.data && metaRes.data.business_phone_number_id) {
          const metaData = metaRes.data;
          accList.push({
            id: metaData.business_phone_number_id,
            type: "meta",
            title: "Meta Cloud API",
            number: metaData.waba_id ? "WABA " + metaData.waba_id : "Cloud API",
            status: "ACTIVE",
            isConnected: true,
            instanceData: metaData,
          });
        }
      } catch (err) {
        console.warn("Failed to load Meta accounts:", err);
      }

      // Detect newly disconnected instances and wipe their cached data
      const prevAccounts = selectedAccountRef.current ? [selectedAccountRef.current] : [];
      accList.forEach((newAcc) => {
        if (newAcc.type === 'all') return;
        const wasConnected = prevAccounts.find((p) => p.id === newAcc.id)?.isConnected;
        if (wasConnected && !newAcc.isConnected) {
          // Wipe chat + message cache for this disconnected instance
          delete accountChatCache.current[newAcc.id];
          Object.keys(conversationMsgCache.current).forEach((key) => {
            if (key.startsWith(newAcc.id + ':')) {
              delete conversationMsgCache.current[key];
            }
          });

          // If this is the currently viewed account, clear the visible UI
          if (selectedAccountRef.current?.id === newAcc.id) {
            setChats([]);
            setHasMoreChats(false);
            setSelectedConversation(null);
            setSelectedContact(null);
            setMessages([]);
            setCountDownTimer(null);
            setIsMobileChatOpen(false);
            toast.warning(`"${newAcc.title}" disconnected — inbox cleared`);
          }
        }
      });

      setAccounts(accList);

      // Auto-select if none selected
      if (!selectedAccountRef.current && accList.length > 0) {
        const firstActive = accList.find((a) => a.type !== "all" && a.isConnected) || accList[0];
        setSelectedAccountState(firstActive);
      }
    } catch (err) {
      console.error("Error refreshing accounts:", err);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // 2. Load available chat tags
  useEffect(() => {
    inboxApi
      .getChatTags()
      .then((res) => {
        if (res && res.success && Array.isArray(res.data)) {
          setAvailableTags(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // 3. Fetch Chats (Paginated / Infinite Scroll)
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const fetchChats = useCallback(
    async (reset: boolean = true, customSearch?: string) => {
      const acc = selectedAccountRef.current;
      const accountKey = acc?.id || "all";
      const origin = acc && acc.type !== "all" ? acc.type : "";

      const currentChats = chatsRef.current;
      const offset = reset ? 0 : currentChats.length;
      const effectiveSearch = customSearch !== undefined ? customSearch : searchQueryRef.current;

      if (reset) {
        // Skip cache if the selected account is known-disconnected (don't serve stale chats)
        const isDisconnected = acc && acc.type === 'qr' && !acc.isConnected;
        const cached = !isDisconnected ? accountChatCache.current[accountKey] : null;
        if (cached && cached.chats.length > 0 && !effectiveSearch) {
          setChats(cached.chats);
          setHasMoreChats(cached.hasMore);
          setLoadingChats(false);
        } else {
          setLoadingChats(true);
        }
      } else {
        setLoadingMoreChats(true);
      }

      try {
        const res = await inboxApi.getChats({
          accountId: acc?.id !== "all" ? acc?.id : undefined,
          origin: origin || undefined,
          search: effectiveSearch.trim() || undefined,
          filter: filterTab,
          limit: 30,
          offset,
        });

        if (res && res.success && Array.isArray(res.chats)) {
          // If backend flagged instance as disconnected, wipe cache and show empty
          if ((res as any).disconnected) {
            delete accountChatCache.current[accountKey];
            setChats([]);
            setHasMoreChats(false);
          } else {
            const newBatch = res.chats;
            const hasMore = !!res.hasMore;

            setChats((prev) => {
              let combined: ChatItem[];
              if (reset) {
                combined = newBatch;
              } else {
                // Deduplicate by chat_id
                const existingIds = new Set(prev.map((c) => c.chat_id));
                const filteredBatch = newBatch.filter((c) => !existingIds.has(c.chat_id));
                combined = [...prev, ...filteredBatch];
              }

              // Save to account cache if not searching
              if (!effectiveSearch) {
                accountChatCache.current[accountKey] = {
                  chats: combined,
                  hasMore,
                };
              }

              return combined;
            });

            setHasMoreChats(hasMore);
          }
        }
      } catch (err) {
        console.error("Failed to load chats:", err);
        if (reset) {
          toast.error("Failed to load conversations");
        }
      } finally {
        setLoadingChats(false);
        setLoadingMoreChats(false);
      }
    },
    [filterTab]
  );

  // Load more chats on scroll to bottom
  const loadMoreChats = useCallback(async () => {
    if (loadingMoreChats || !hasMoreChats) return;
    await fetchChats(false);
  }, [loadingMoreChats, hasMoreChats, fetchChats]);

  // Refresh chat list manually
  const refreshChats = useCallback(async () => {
    await fetchChats(true);
  }, [fetchChats]);

  // Trigger chats load when account changes or filterTab changes
  useEffect(() => {
    fetchChats(true);
  }, [selectedAccount?.id, filterTab, fetchChats]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChats(true, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchChats]);

  // 4. Safe Account Switching (Clear conversation state immediately)
  const setSelectedAccount = useCallback((acc: InboxAccount) => {
    if (selectedAccountRef.current?.id === acc.id) return;

    // Immediately isolate state to prevent cross-account leaks
    setSelectedConversation(null);
    setSelectedContact(null);
    setMessages([]);
    setCountDownTimer(null);
    setIsMobileChatOpen(false);
    setHasMoreMessages(false);

    // If target account has cached chats, load immediately to prevent layout flash
    const cached = accountChatCache.current[acc.id];
    if (cached) {
      setChats(cached.chats);
      setHasMoreChats(cached.hasMore);
      setLoadingChats(false);
    } else {
      setChats([]);
      setHasMoreChats(false);
      setLoadingChats(true);
    }

    setSelectedAccountState(acc);
    toast.info("Switched to " + acc.title);
  }, []);

  // 5. Select and load a conversation
  const selectConversation = useCallback(
    async (chat: ChatItem | null) => {
      if (!chat) {
        setSelectedConversation(null);
        setSelectedContact(null);
        setMessages([]);
        setCountDownTimer(null);
        setIsMobileChatOpen(false);
        setHasMoreMessages(false);
        return;
      }

      // Check if already selected
      if (selectedConversationRef.current?.chat_id === chat.chat_id) {
        setIsMobileChatOpen(true);
        return;
      }

      const accId = selectedAccountRef.current?.id || "all";
      const cacheKey = accId + ":" + chat.chat_id;

      setSelectedConversation(chat);
      setSelectedContact(chat.contactData || { name: chat.sender_name, mobile: chat.sender_mobile });
      setIsMobileChatOpen(true);

      // Check cache for this conversation
      const cached = conversationMsgCache.current[cacheKey];
      if (cached && cached.messages.length > 0) {
        setMessages(cached.messages);
        setHasMoreMessages(cached.hasMore);
        setLoadingMessages(false);
      } else {
        setMessages([]);
        setHasMoreMessages(false);
        setLoadingMessages(true);
      }

      // Mark unread in local state immediately
      setChats((prev) =>
        prev.map((c) => (c.chat_id === chat.chat_id ? { ...c, unread_count: 0 } : c))
      );

      // Fetch recent messages via REST
      try {
        const res = await inboxApi.getMessages(chat.chat_id, { limit: 30, offset: 0 });
        if (res && res.success && Array.isArray(res.messages)) {
          // Stale response check: ensure conversation did not change during request
          if (selectedConversationRef.current?.chat_id === chat.chat_id) {
            setMessages(res.messages);
            setHasMoreMessages(!!res.hasMore);

            conversationMsgCache.current[cacheKey] = {
              messages: res.messages,
              hasMore: !!res.hasMore,
            };

            if (res.chatInfo?.contactData) {
              setSelectedContact(res.chatInfo.contactData);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load conversation messages:", err);
      } finally {
        if (selectedConversationRef.current?.chat_id === chat.chat_id) {
          setLoadingMessages(false);
        }
      }

      // Emit socket load_conversation for realtime labels/notes synchronization
      if (socket && socket.connected) {
        socket.emit("message", {
          type: "load_conversation",
          payload: {
            chat: { id: chat.id, chat_id: chat.chat_id },
            filters: { limit: 30, offset: 0 },
          },
        });
      }
    },
    [socket]
  );

  // Load older messages (Prepend to messages list, preserving scroll position)
  const loadOlderMessages = useCallback(async () => {
    const chat = selectedConversationRef.current;
    if (!chat || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);
    const currentMsgs = messagesRef.current;
    const accId = selectedAccountRef.current?.id || "all";
    const cacheKey = accId + ":" + chat.chat_id;

    try {
      const res = await inboxApi.getMessages(chat.chat_id, {
        limit: 30,
        offset: currentMsgs.length,
      });

      if (res && res.success && Array.isArray(res.messages)) {
        if (selectedConversationRef.current?.chat_id === chat.chat_id) {
          const olderBatch = res.messages;
          const hasMore = !!res.hasMore;

          setMessages((prev) => {
            const existingIds = new Set(
              prev.map((m) => m.metaChatId || String(m.id || ""))
            );
            const filteredOlder = olderBatch.filter(
              (m) => !existingIds.has(m.metaChatId || String(m.id || ""))
            );
            const combined = [...filteredOlder, ...prev];

            conversationMsgCache.current[cacheKey] = {
              messages: combined,
              hasMore,
            };

            return combined;
          });

          setHasMoreMessages(hasMore);
        }
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [loadingOlderMessages, hasMoreMessages]);

  // Start a new conversation draft
  const startNewConversation = useCallback((newChat: ChatItem) => {
    setSelectedConversation(newChat);
    setSelectedContact(newChat.contactData || { name: newChat.sender_name, mobile: newChat.sender_mobile });
    setMessages([]);
    setHasMoreMessages(false);
    setIsMobileChatOpen(true);
    setIsNewChatOpen(false);
  }, []);

  // 6. Socket event listeners for realtime updates
  useEffect(() => {
    if (!socket) return;

    // Realtime incoming / outgoing message
    const handleNewMessage = (data: any) => {
      const activeChatId = selectedConversationRef.current?.chat_id;
      const incomingChatId = data?.chatId;
      const newMsg = data?.message;

      if (!newMsg || !incomingChatId) return;

      // 1. If currently open in active chat, append or update message
      if (activeChatId && incomingChatId === activeChatId) {
        setMessages((prev) => {
          const existsIndex = prev.findIndex(
            (m) =>
              (m.metaChatId && newMsg.metaChatId && m.metaChatId === newMsg.metaChatId) ||
              (m.id && newMsg.id && m.id === newMsg.id)
          );
          if (existsIndex >= 0) {
            const existing = prev[existsIndex];
            const currRank = STATUS_RANK[existing.status?.toLowerCase() || ""] || 0;
            const newRank = STATUS_RANK[newMsg.status?.toLowerCase() || ""] || 0;
            const updated = [...prev];
            updated[existsIndex] = {
              ...existing,
              ...newMsg,
              status: newRank >= currRank ? (newMsg.status || existing.status) : existing.status,
              isOptimistic: false,
            };
            return updated;
          }
          return [...prev, newMsg];
        });
      }

      // 2. Incremental Chat List Update (Move chat to top, update preview & unread count)
      setChats((prev) => {
        const chatIdx = prev.findIndex((c) => c.chat_id === incomingChatId);
        const isCurrentOpen = activeChatId === incomingChatId;

        if (chatIdx === -1) {
          // Unknown chat received: create chat item placeholder and insert at top
          const newChatItem: ChatItem = {
            id: Date.now(),
            chat_id: incomingChatId,
            uid: "",
            sender_name: newMsg.senderName || newMsg.senderMobile || "New Contact",
            sender_mobile: newMsg.senderMobile || "",
            last_message: newMsg,
            unread_count: isCurrentOpen ? 0 : 1,
            origin: newMsg.origin || "qr",
            updatedAt: new Date().toISOString(),
          };
          return [newChatItem, ...prev];
        }

        const existingChat = prev[chatIdx];
        const updatedChat: ChatItem = {
          ...existingChat,
          last_message: newMsg,
          unread_count: isCurrentOpen ? 0 : (existingChat.unread_count || 0) + 1,
          updatedAt: new Date().toISOString(),
        };

        const remaining = prev.filter((_, idx) => idx !== chatIdx);
        return [updatedChat, ...remaining];
      });
    };

    // Chat list update trigger from socket
    const handleRequestUpdateChatList = () => {
      fetchChats(true);
    };

    // Opened chat update trigger
    const handleRequestUpdateOpenedChat = () => {
      if (selectedConversationRef.current && socket.connected) {
        socket.emit("message", {
          type: "load_conversation",
          payload: {
            chat: {
              id: selectedConversationRef.current.id,
              chat_id: selectedConversationRef.current.chat_id,
            },
            filters: { limit: 30, offset: 0 },
          },
        });
      }
    };

    const handleLoadConversation = (data: any) => {
      if (selectedConversationRef.current && data.chatInfo) {
        if (data.chatInfo.chat_id !== selectedConversationRef.current.chat_id) {
          return; // Ignore stale response
        }
      }

      if (data.countDownTimer) {
        setCountDownTimer(data.countDownTimer);
      }
      if (Array.isArray(data.labelsAdded)) {
        setAvailableTags(data.labelsAdded);
      }
    };

    const handleError = (data: any) => {
      const msg = data?.msg || "An error occurred with chat service";
      toast.error(msg);
    };

    // Realtime message delivery & read status updates
    const handleStatusUpdate = (data: {
      chatId?: string;
      messageId?: string;
      status?: string;
      timestamp?: number;
    }) => {
      if (!data?.messageId || !data?.status) return;
      const targetStatus = data.status.toLowerCase();
      const targetRank = STATUS_RANK[targetStatus] || 0;
      if (!targetRank) return;

      const incomingChatId = data.chatId;
      const activeChatId = selectedConversationRef.current?.chat_id;

      // 1. Update open conversation messages if matching
      if (!incomingChatId || (activeChatId && incomingChatId === activeChatId)) {
        setMessages((prev) =>
          prev.map((m) => {
            const isMatch =
              (m.metaChatId && m.metaChatId === data.messageId) ||
              (m.id && String(m.id) === String(data.messageId));
            if (isMatch) {
              const currRank = STATUS_RANK[m.status?.toLowerCase() || ""] || 0;
              if (targetRank > currRank) {
                return { ...m, status: targetStatus, isOptimistic: false };
              }
            }
            return m;
          })
        );
      }

      // 2. Update chat list preview status
      setChats((prev) =>
        prev.map((c) => {
          const isChatMatch = !incomingChatId || c.chat_id === incomingChatId;
          if (isChatMatch && c.last_message) {
            const isMsgMatch =
              c.last_message.metaChatId === data.messageId ||
              String(c.last_message.id) === String(data.messageId);
            if (isMsgMatch) {
              const currRank = STATUS_RANK[c.last_message.status?.toLowerCase() || ""] || 0;
              if (targetRank > currRank) {
                return {
                  ...c,
                  last_message: { ...c.last_message, status: targetStatus },
                };
              }
            }
          }
          return c;
        })
      );

      // 3. Update cached conversation messages
      if (incomingChatId) {
        Object.keys(conversationMsgCache.current).forEach((key) => {
          if (key.endsWith(":" + incomingChatId)) {
            const cached = conversationMsgCache.current[key];
            if (cached && Array.isArray(cached.messages)) {
              cached.messages = cached.messages.map((m) => {
                const isMatch =
                  (m.metaChatId && m.metaChatId === data.messageId) ||
                  (m.id && String(m.id) === String(data.messageId));
                if (isMatch) {
                  const currRank = STATUS_RANK[m.status?.toLowerCase() || ""] || 0;
                  if (targetRank > currRank) {
                    return { ...m, status: targetStatus, isOptimistic: false };
                  }
                }
                return m;
              });
            }
          }
        });
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("request_update_chat_list", handleRequestUpdateChatList);
    socket.on("request_update_opened_chat", handleRequestUpdateOpenedChat);
    socket.on("load_conversation", handleLoadConversation);
    socket.on("error", handleError);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("request_update_chat_list", handleRequestUpdateChatList);
      socket.off("request_update_opened_chat", handleRequestUpdateOpenedChat);
      socket.off("load_conversation", handleLoadConversation);
      socket.off("error", handleError);
    };
  }, [socket, fetchChats]);

  // 7. Actions: Send Text Message
  const sendTextMessage = async (text: string): Promise<boolean> => {
    if (!text.trim() || !selectedConversation) {
      toast.error("Please enter a message and select a conversation");
      return false;
    }

    const currentChat = selectedConversation;
    const currentAccount = selectedAccountRef.current;
    const optimisticId = "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const optimisticMsg: ConversationMessage = {
      chat_id: currentChat.chat_id,
      metaChatId: optimisticId,
      type: "text",
      msgContext: {
        type: "text",
        text: { body: text.trim(), preview_url: true },
      },
      route: "OUTGOING",
      timestamp: Math.floor(Date.now() / 1000),
      senderName: "Me",
      senderMobile: currentChat.sender_mobile,
      status: "sending",
      isOptimistic: true,
      origin: currentChat.origin,
    };

    // Prepend to messages state
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      // Dispatch via REST endpoint
      const res = await inboxApi.sendMessage({
        chat_id: currentChat.chat_id,
        message: text.trim(),
        type: "text",
        accountId: currentAccount?.id !== "all" ? currentAccount?.id : undefined,
      });

      if (res && res.success && res.message) {
        // Replace optimistic message with server message (confirmed sent)
        const serverMsg = {
          ...res.message,
          status: res.message.status || "sent",
          isOptimistic: false,
        };
        setMessages((prev) =>
          prev.map((m) => (m.metaChatId === optimisticId ? serverMsg : m))
        );

        // Move chat to top of chat list
        setChats((prev) => {
          const chatIdx = prev.findIndex((c) => c.chat_id === currentChat.chat_id);
          const updatedChat: ChatItem = {
            ...currentChat,
            last_message: res.message,
            updatedAt: new Date().toISOString(),
          };
          if (chatIdx === -1) {
            return [updatedChat, ...prev];
          }
          const remaining = prev.filter((_, idx) => idx !== chatIdx);
          return [updatedChat, ...remaining];
        });

        return true;
      } else {
        throw new Error("Send failed");
      }
    } catch (err: any) {
      console.warn("REST send failed, attempting socket fallback:", err);

      // Fallback via socket
      if (socket && socket.connected) {
        socket.emit("message", {
          type: "send_chat_message",
          payload: {
            type: "text",
            msgCon: {
              type: "text",
              text: { body: text.trim(), preview_url: true },
            },
            chatInfo: currentChat,
          },
        });
        return true;
      }

      setMessages((prev) =>
        prev.map((m) => (m.metaChatId === optimisticId ? { ...m, isFailed: true } : m))
      );
      toast.error(err.message || "Failed to send message");
      return false;
    }
  };

  // 8. Actions: Send Media Message
  const sendMediaMessage = async (file: File, caption: string = ""): Promise<boolean> => {
    if (!file || !selectedConversation) {
      toast.error("Please select a file and ensure chat is active");
      return false;
    }

    const currentChat = selectedConversation;
    let mediaType: "image" | "video" | "audio" | "document" = "document";
    if (file.type.startsWith("image/")) mediaType = "image";
    else if (file.type.startsWith("video/")) mediaType = "video";
    else if (file.type.startsWith("audio/")) mediaType = "audio";

    try {
      toast.loading("Uploading media file...", { id: "media_upload" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", currentChat.origin === "qr" ? "baileys" : "meta");

      const uploadRes = await inboxApi.uploadMedia(formData);
      if (!uploadRes || !uploadRes.success || !uploadRes.url) {
        toast.error(uploadRes?.msg || "Failed to upload media file", { id: "media_upload" });
        return false;
      }

      toast.success("Media uploaded, dispatching message...", { id: "media_upload" });

      const fileUrl = uploadRes.url.startsWith("http")
        ? uploadRes.url
        : window.location.origin + "/media/" + uploadRes.url;

      const res = await inboxApi.sendMessage({
        chat_id: currentChat.chat_id,
        media_url: fileUrl,
        type: mediaType,
        caption: caption.trim(),
        accountId: selectedAccountRef.current?.id !== "all" ? selectedAccountRef.current?.id : undefined,
      });

      if (res && res.success && res.message) {
        setMessages((prev) => [...prev, res.message]);
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || "Failed to upload and send media", { id: "media_upload" });
      return false;
    }
  };

  // 9. Actions: Send Meta WhatsApp Template (STRICTLY FOR META ONLY)
  const sendMetaTemplate = async (
    templateName: string,
    templateBody: string,
    language: string = "en",
    variables?: Record<string, string> | any[],
    components?: any[]
  ): Promise<boolean> => {
    if (!selectedConversation) {
      toast.error("No conversation selected");
      return false;
    }

    // Critical Rule: QR Cannot Send Meta Templates
    if (selectedConversation.origin === "qr" || selectedAccount?.type === "qr") {
      toast.error("Templates are available only for Meta Cloud API WhatsApp connections.");
      return false;
    }

    if (!socket || !socket.connected) {
      toast.error("Chat socket disconnected");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        socket.off("template_send_result", onResult);
        socket.off("error", onError);
        if (timer) clearTimeout(timer);
      };

      const onResult = (data: any) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (data && data.success) {
          toast.success(`Template "${templateName}" sent successfully!`);
          resolve(true);
        } else {
          const errMsg = data?.msg || "Failed to send template message via Meta Cloud API";
          toast.error(errMsg);
          resolve(false);
        }
      };

      const onError = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        // Global socket error handler will also toast, but ensure Promise resolves false
        resolve(false);
      };

      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        toast.error("Template send request timed out. Please check your connection.");
        resolve(false);
      }, 20000);

      socket.on("template_send_result", onResult);
      socket.once("error", onError);

      socket.emit(
        "message",
        {
          type: "send_template_to_conversation",
          payload: {
            chatInfo: selectedConversation,
            templateName,
            templateBody,
            templateLanguage: language,
            variables: variables || {},
            components: components || [],
            messageId: "tpl_" + Date.now(),
          },
        },
        (ackData: any) => {
          onResult(ackData);
        }
      );
    });
  };

  // 10. Labels and Notes
  const addTagToChat = async (tagTitle: string) => {
    if (!selectedConversation || !socket) return;
    socket.emit("message", {
      type: "set_chat_label",
      payload: {
        chat_id: selectedConversation.chat_id,
        label: { title: tagTitle },
      },
    });
    toast.success("Added tag \"" + tagTitle + "\"");
  };

  const removeTagFromChat = async (tagTitle: string) => {
    if (!selectedConversation || !socket) return;
    socket.emit("message", {
      type: "remove_chat_label",
      payload: {
        chat_id: selectedConversation.chat_id,
        label: { title: tagTitle },
      },
    });
    toast.success("Removed tag \"" + tagTitle + "\"");
  };

  const addNoteToChat = async (noteText: string) => {
    if (!selectedConversation || !socket || !noteText.trim()) return;
    socket.emit("message", {
      type: "save_chat_note",
      payload: {
        chat_id: selectedConversation.chat_id,
        note: {
          id: "note_" + Date.now(),
          text: noteText.trim(),
          timestamp: new Date().toISOString(),
        },
      },
    });
    toast.success("Note saved");
  };

  const deleteNoteFromChat = async (noteId: string) => {
    if (!selectedConversation || !socket) return;
    socket.emit("message", {
      type: "delete_chat_note",
      payload: {
        chat_id: selectedConversation.chat_id,
        noteId,
      },
    });
    toast.success("Note deleted");
  };

  const markChatAsRead = () => {
    if (!selectedConversation) return;
    setChats((prev) =>
      prev.map((c) => (c.chat_id === selectedConversation.chat_id ? { ...c, unread_count: 0 } : c))
    );
  };

  return (
    <InboxContext.Provider
      value={{
        accounts,
        selectedAccount,
        setSelectedAccount,
        refreshAccounts,
        chats,
        loadingChats,
        hasMoreChats,
        loadingMoreChats,
        loadMoreChats,
        searchQuery,
        setSearchQuery,
        filterTab,
        setFilterTab,
        refreshChats,
        selectedConversation,
        selectConversation,
        startNewConversation,
        selectedContact,
        loadingMessages,
        hasMoreMessages,
        loadingOlderMessages,
        loadOlderMessages,
        messages,
        countDownTimer,
        availableTags,
        sendTextMessage,
        sendMediaMessage,
        sendMetaTemplate,
        addTagToChat,
        removeTagFromChat,
        addNoteToChat,
        deleteNoteFromChat,
        markChatAsRead,
        showContactPanel,
        setShowContactPanel,
        isMobileChatOpen,
        setIsMobileChatOpen,
        isNewChatOpen,
        setIsNewChatOpen,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error("useInbox must be used within an InboxProvider");
  }
  return context;
}