import { api } from './client';
import { API_ENDPOINTS } from '@/config/api';
import {
  SupportTicket,
  SupportMessage,
  SupportCategory,
  SupportPriority,
  SupportStatus,
  SupportAttachment,
  SupportCounts,
} from '@/types/support';

export const supportApi = {
  // User endpoints
  getUserTickets: () => {
    return api.get<{
      success: boolean;
      tickets: SupportTicket[];
      counts: SupportCounts;
    }>(API_ENDPOINTS.support.tickets);
  },

  createTicket: (data: {
    subject: string;
    category: SupportCategory;
    priority?: SupportPriority;
    message: string;
    attachments?: SupportAttachment[];
  }) => {
    return api.post<{
      success: boolean;
      msg: string;
      ticket: SupportTicket;
    }>(API_ENDPOINTS.support.tickets, data);
  },

  getTicketDetail: (id: number | string) => {
    return api.get<{
      success: boolean;
      ticket: SupportTicket;
      messages: SupportMessage[];
    }>(API_ENDPOINTS.support.ticketDetail(id));
  },

  replyTicket: (
    id: number | string,
    message: string,
    attachments?: SupportAttachment[]
  ) => {
    return api.post<{ success: boolean; msg: string }>(
      API_ENDPOINTS.support.reply(id),
      { message, attachments }
    );
  },

  closeTicket: (id: number | string) => {
    return api.post<{ success: boolean; msg: string }>(
      API_ENDPOINTS.support.close(id)
    );
  },

  // Admin endpoints
  getAdminTickets: (params?: {
    search?: string;
    status?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = qs
      ? `${API_ENDPOINTS.support.adminTickets}?${qs}`
      : API_ENDPOINTS.support.adminTickets;

    return api.get<{
      success: boolean;
      tickets: SupportTicket[];
      total: number;
      page: number;
      limit: number;
      counts: SupportCounts;
    }>(endpoint);
  },

  getAdminTicketDetail: (id: number | string) => {
    return api.get<{
      success: boolean;
      ticket: SupportTicket;
      messages: SupportMessage[];
    }>(API_ENDPOINTS.support.adminTicketDetail(id));
  },

  adminReply: (
    id: number | string,
    message: string,
    status?: SupportStatus,
    attachments?: SupportAttachment[]
  ) => {
    return api.post<{ success: boolean; msg: string }>(
      API_ENDPOINTS.support.adminReply(id),
      { message, status, attachments }
    );
  },

  adminUpdateStatus: (
    id: number | string,
    status: SupportStatus,
    priority?: SupportPriority
  ) => {
    return api.post<{ success: boolean; msg: string }>(
      API_ENDPOINTS.support.adminStatus(id),
      { status, priority }
    );
  },
};
