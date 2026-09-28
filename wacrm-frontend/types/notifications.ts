export interface InAppNotification {
  id: number;
  uid: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ALERT' | 'SYSTEM';
  action_url: string | null;
  is_read: number;
  created_at: string;
}

export type BroadcastAudienceType = 'single' | 'multiple' | 'plan' | 'all';
export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface SendNotificationPayload {
  title: string;
  message: string;
  channels: NotificationChannel[];
  audience_type: BroadcastAudienceType;
  target_uids?: string[];
  target_plan_id?: string | number;
  action_url?: string;
}

export interface BroadcastHistoryItem {
  id: number;
  admin_uid: string;
  title: string;
  message: string;
  channels: string;
  audience_type: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: 'SENT' | 'FAILED' | 'PARTIAL';
  details: any;
  created_at: string;
}

export interface MailTemplateItem {
  id: number;
  name: string;
  subject: string;
  body: string;
  variables: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLogItem {
  id: number;
  admin_uid: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}
