export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type MessageDirection = "inbound" | "outbound" | "INCOMING" | "OUTGOING";
export type MediaType = "text" | "image" | "video" | "audio" | "document" | "location" | "interactive" | "template" | "button" | "poll" | "sticker";

export interface InboxAccount {
  id: string; // uniqueId or business_phone_number_id or "all"
  type: "qr" | "meta" | "all";
  title: string;
  number: string;
  status: "ACTIVE" | "INACTIVE";
  isConnected: boolean;
  instanceData?: any;
}

export interface ChatContactData {
  id?: number;
  uid?: string;
  name?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  tags?: string[];
  notes?: Array<{ id?: string; text: string; author?: string; email?: string; timestamp?: string }>;
}

export interface ChatItem {
  id: number;
  chat_id: string;
  uid: string;
  sender_name: string;
  sender_mobile: string;
  last_message: any; // string or parsed JSON
  unread_count: number;
  origin: "qr" | "meta" | string;
  origin_instance_id?: string;
  chat_label?: string | any[];
  chat_note?: string | any[];
  assigned_agent?: string | any[];
  updatedAt: string;
  createdAt?: string;
  contactData?: ChatContactData | null;
}

export interface ConversationMessage {
  id?: number;
  chat_id: string;
  metaChatId?: string;
  type: string;
  status?: string;
  msgContext: any;
  reaction?: string;
  timestamp: string | number;
  senderName?: string;
  senderMobile?: string;
  star?: number | boolean;
  route: "INCOMING" | "OUTGOING";
  context?: any;
  origin?: string;
  sentBy?: string;
  isOptimistic?: boolean;
  isFailed?: boolean;
}

export interface CountDownTimer {
  timestamp: number | string;
  timezone: string;
}

export interface ChatTagItem {
  id: number;
  uid: string;
  title: string;
  color?: string;
}

// Backward compatibility types
export interface ChatContact {
  id: number;
  uid: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  assigned_agent_id?: number | null;
  created_at?: string;
}

export interface ChatMessage {
  id: number;
  msg_id: string;
  chat_id: string;
  sender_phone: string;
  receiver_phone: string;
  direction: MessageDirection;
  type: MediaType;
  content: string;
  media_url?: string;
  status: MessageStatus;
  timestamp: string;
  is_template?: boolean;
}

export interface ChatSession {
  id: string;
  contact: ChatContact;
  last_message?: ChatMessage;
  unread_count: number;
  updated_at: string;
}
