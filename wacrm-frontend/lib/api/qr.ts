import { api } from '@/lib/api/client';
import { QrInstance } from '@/types/qr';

export const qrApi = {
  /**
   * Fetch all QR instances for current user
   */
  async getInstances(): Promise<{ success: boolean; data: QrInstance[] }> {
    const res = await api.get<{ success: boolean; data: QrInstance[] }>('/api/qr/get_instances');
    return {
      success: res.success ?? true,
      data: res.data || [],
    };
  },

  /**
   * Request backend to initialize Baileys session and start QR generation
   */
  async generateQr(payload: {
    title: string;
    uniqueId: string;
  }): Promise<{ success: boolean; msg: string }> {
    return api.post<{ success: boolean; msg: string }>('/api/qr/gen_qr', payload);
  },

  /**
   * Query status and QR data for a specific instance
   */
  async getQrStatus(uniqueId: string): Promise<{ success: boolean; data: QrInstance }> {
    return api.get<{ success: boolean; data: QrInstance }>('/api/qr/get_qr_status', {
      params: { uniqueId },
    });
  },

  /**
   * Logout WhatsApp session while preserving instance record
   */
  async logoutInstance(uniqueId: string): Promise<{ success: boolean; msg: string }> {
    return api.post<{ success: boolean; msg: string }>('/api/qr/logout_instance', { uniqueId });
  },

  /**
   * Cancel an in-progress pending QR session (modal close / explicit cancel)
   */
  async cancelPending(uniqueId: string): Promise<{ success: boolean; msg: string }> {
    return api.post<{ success: boolean; msg: string }>('/api/qr/cancel_pending', { uniqueId });
  },

  /**
   * Reconnect an existing inactive WhatsApp instance
   */
  async reconnectInstance(uniqueId: string): Promise<{ success: boolean; msg: string; data?: { uniqueId: string } }> {
    return api.post<{ success: boolean; msg: string; data?: { uniqueId: string } }>('/api/qr/reconnect_instance', { uniqueId });
  },

  /**
   * Permanently delete instance and purge session data
   */
  async deleteInstance(uniqueId: string): Promise<{ success: boolean; msg: string }> {
    return api.post<{ success: boolean; msg: string }>('/api/qr/del_instance', { uniqueId });
  },
};

export default qrApi;
