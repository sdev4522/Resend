import { api } from './client';
import { MailTemplateItem, AdminAuditLogItem } from '@/types/notifications';

export interface SMTPConfig {
  id?: number | string;
  email: string;
  host: string;
  port: string;
  username: string;
  password?: string;
  has_password?: boolean;
}

export const mailApi = {
  /**
   * Fetch current SMTP configuration (password is masked)
   */
  async getSmtp(): Promise<SMTPConfig> {
    const res = await api.get<{ success: boolean; data: SMTPConfig }>('/admin/get_smtp');
    return res?.data || {
      email: '',
      host: '',
      port: '587',
      username: '',
      has_password: false,
      password: '',
    };
  },

  /**
   * Save SMTP configuration (blank password preserves existing)
   */
  async updateSmtp(config: SMTPConfig): Promise<{ success: boolean; msg: string }> {
    const res = await api.post<{ success: boolean; msg: string }>('/admin/update_smtp', config);
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to update SMTP settings');
    }
    return res;
  },

  /**
   * Send test email to verify SMTP delivery
   */
  async sendTestEmail(payload: {
    to: string;
    email?: string;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
  }): Promise<{ success: boolean; msg: string }> {
    const res = await api.post<{ success: boolean; msg: string }>('/admin/send_test_email', payload);
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to send test email');
    }
    return res;
  },

  /**
   * Mail templates CRUD
   */
  async getTemplates(): Promise<MailTemplateItem[]> {
    const res = await api.get<{ success: boolean; data: MailTemplateItem[] }>('/admin/mail_templates');
    return res?.data || [];
  },

  async saveTemplate(template: {
    id?: number;
    name: string;
    subject: string;
    body: string;
    variables?: string;
    is_active?: boolean;
  }): Promise<{ success: boolean; msg: string }> {
    const res = await api.post<{ success: boolean; msg: string }>('/admin/save_mail_template', template);
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to save template');
    }
    return res;
  },

  async deleteTemplate(id: number): Promise<{ success: boolean; msg: string }> {
    const res = await api.post<{ success: boolean; msg: string }>('/admin/del_mail_template', { id });
    if (!res?.success) {
      throw new Error(res?.msg || 'Failed to delete template');
    }
    return res;
  },

  async previewTemplate(subject: string, body: string): Promise<{
    renderedSubject: string;
    renderedBody: string;
  }> {
    const res = await api.post<{
      success: boolean;
      data: { renderedSubject: string; renderedBody: string };
    }>('/admin/preview_mail_template', { subject, body });
    return res?.data || { renderedSubject: subject, renderedBody: body };
  },

  /**
   * Admin audit logs
   */
  async getAuditLogs(): Promise<AdminAuditLogItem[]> {
    const res = await api.get<{ success: boolean; data: AdminAuditLogItem[] }>('/admin/get_audit_logs');
    return res?.data || [];
  },
};
