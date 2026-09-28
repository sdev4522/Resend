import { api } from './client';
import {
  InAppNotification,
  SendNotificationPayload,
  BroadcastHistoryItem,
} from '@/types/notifications';

export const notificationsApi = {
  /**
   * Fetch in-app notifications for authenticated user
   */
  async getUserNotifications(): Promise<{
    notifications: InAppNotification[];
    unreadCount: number;
  }> {
    const res = await api.get<{
      success: boolean;
      data: InAppNotification[];
      unreadCount: number;
    }>('/user/notifications');
    return {
      notifications: res?.data || [],
      unreadCount: res?.unreadCount || 0,
    };
  },

  /**
   * Mark a single notification or all as read
   */
  async markRead(id?: number, all = false): Promise<void> {
    await api.post('/user/mark_notification_read', { id, all });
  },

  /**
   * Admin broadcast notification to users
   */
  async sendNotification(payload: SendNotificationPayload): Promise<{
    success: boolean;
    msg: string;
    data: {
      recipientsTotal: number;
      sentCount: number;
      failedCount: number;
    };
  }> {
    const res = await api.post<any>('/admin/send_notification', payload);
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to dispatch notification');
    }
    return res;
  },

  /**
   * Fetch broadcast history for admin
   */
  async getBroadcastHistory(): Promise<BroadcastHistoryItem[]> {
    const res = await api.get<{ success: boolean; data: BroadcastHistoryItem[] }>(
      '/admin/notification_history'
    );
    return res?.data || [];
  },
};
