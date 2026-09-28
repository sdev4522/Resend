export type SupportCategory =
  | 'technical'
  | 'whatsapp'
  | 'billing'
  | 'campaign'
  | 'automation'
  | 'account'
  | 'other';

export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'closed';

export interface SupportAttachment {
  name: string;
  url: string;
  size?: number;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_type: 'user' | 'admin';
  sender_id: string;
  sender_name: string;
  message: string;
  attachments?: SupportAttachment[];
  created_at: string;
}

export interface SupportTicket {
  id: number;
  ticket_number: string;
  uid: string;
  workspace_id?: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string;
  user_name?: string;
  user_email?: string;
  user_company?: string;
  user_mobile?: string;
}

export interface SupportTicketDetail {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

export interface SupportCounts {
  all: number;
  open: number;
  in_progress?: number;
  waiting_user?: number;
  resolved: number;
  closed: number;
}
