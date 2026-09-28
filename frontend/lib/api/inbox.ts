import { api } from "./client";
import { API_ENDPOINTS } from "@/config/api";
import { ChatSession, ChatMessage, ChatTagItem, ChatItem, ConversationMessage } from "@/types/inbox";

export interface PhonebookContact {
  id: number;
  name: string;
  mobile: string;
  phonebook_name?: string;
  var1?: string;
  var2?: string;
}

export const inboxApi = {
  getChats: (params?: {
    accountId?: string;
    origin?: string;
    search?: string;
    filter?: string;
    limit?: number;
    offset?: number;
  }) => {
    return api.get<{
      success: boolean;
      chats: ChatItem[];
      total: number;
      hasMore: boolean;
      offset: number;
      limit: number;
    }>("/api/inbox/get_chats", { params });
  },

  getMessages: (chatId: string, params?: { limit?: number; offset?: number; before?: string }) => {
    return api.get<{
      success: boolean;
      messages: ConversationMessage[];
      chatInfo?: any;
      total: number;
      hasMore: boolean;
      offset: number;
      limit: number;
    }>("/api/inbox/get_messages", {
      params: { chat_id: chatId, ...params },
    });
  },

  sendMessage: (payload: {
    chat_id: string;
    message?: string;
    type?: string;
    media_url?: string;
    caption?: string;
    accountId?: string;
  }) => {
    return api.post<{ success: boolean; message: ConversationMessage }>("/api/inbox/send_message", payload);
  },

  checkConversation: (payload: {
    accountId?: string;
    accountType?: string;
    mobile: string;
    name?: string;
  }) => {
    return api.post<{
      success: boolean;
      exists: boolean;
      chat: ChatItem & { isNew?: boolean };
    }>("/api/inbox/check_conversation", payload);
  },

  getPhonebookContacts: (params?: { search?: string; page?: number; limit?: number }) => {
    return api.get<{
      success: boolean;
      data: PhonebookContact[];
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    }>("/api/user/get_phonebook_for_inbox", { params });
  },

  uploadMedia: (formData: FormData) => {
    return api.post<{ success: boolean; url?: string; msg?: string }>("/api/user/upload_media", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getChatTags: () => {
    return api.get<{ success: boolean; data: ChatTagItem[] }>("/api/user/get_chat_tags");
  },

  getMetaTemplates: () => {
    return api.get<{ success: boolean; data: any[] }>("/api/user/get_my_meta_templets");
  },

  getQrInstances: () => {
    return api.get<{ success: boolean; data: any[] }>("/api/qr/get_instances");
  },

  getMetaKeys: () => {
    return api.get<{ success: boolean; data: any }>("/api/user/get_meta_keys");
  },
};
