import { api } from './client';
import {
  MetaTemplate,
  CreateMetaTemplatePayload,
  LocalTemplate,
  MetaConnectionStatus,
} from '@/types/template';

export const templatesApi = {
  // ── Meta Official Cloud API Templates ─────────────────────────────────────
  getMetaTemplates: async (params?: {
    limit?: number;
    after?: string;
    before?: string;
    status?: string;
  }) => {
    try {
      const res = await api.get<{
        success: boolean;
        data?: MetaTemplate[];
        paging?: any;
        msg?: string;
      }>('/api/user/get_my_meta_templets_beta', { params });

      if (res && res.success && Array.isArray(res.data)) {
        return { success: true, data: res.data, paging: res.paging };
      }

      // If beta fails or is empty, try standard endpoint
      const fallback = await api.get<{
        success: boolean;
        data?: MetaTemplate[];
        msg?: string;
      }>('/api/user/get_my_meta_templets');

      if (fallback && fallback.success && Array.isArray(fallback.data)) {
        return { success: true, data: fallback.data };
      }

      return {
        success: false,
        data: [],
        msg: res?.msg || fallback?.msg || 'Unable to fetch templates from Meta.',
      };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        msg: err.message || 'Error communicating with Meta template service.',
      };
    }
  },

  createMetaTemplate: async (payload: CreateMetaTemplatePayload) => {
    try {
      const res = await api.post<{ success?: boolean; msg?: string; error?: any }>(
        '/api/user/add_meta_templet',
        payload
      );

      // Backend returns { msg: "..." } without success flag when Meta returns an error
      if (res?.error || res?.success === false) {
        return {
          success: false,
          msg: res?.msg || 'Meta rejected the template creation request.',
        };
      }

      return {
        success: true,
        msg: res?.msg || 'Template submitted to Meta successfully and is awaiting review.',
      };
    } catch (err: any) {
      return {
        success: false,
        msg: err.message || 'Failed to submit template to Meta.',
      };
    }
  },

  deleteMetaTemplate: async (name: string) => {
    try {
      const res = await api.post<{ success?: boolean; msg?: string }>(
        '/api/user/del_meta_templet',
        { name }
      );

      if (res?.success === false) {
        return { success: false, msg: res?.msg || 'Failed to delete template from Meta.' };
      }

      return { success: true, msg: res?.msg || 'Template was deleted from Meta.' };
    } catch (err: any) {
      return { success: false, msg: err.message || 'Error deleting template from Meta.' };
    }
  },

  getMetaConnectionStatus: async (): Promise<MetaConnectionStatus> => {
    try {
      const res = await api.get<{ success: boolean; data?: any }>('/api/user/get_meta_keys');
      if (res && res.success && res.data && res.data.waba_id) {
        return {
          configured: true,
          waba_id: res.data.waba_id,
          business_phone_number_id: res.data.business_phone_number_id,
          app_id: res.data.app_id,
          login_type: res.data.login_type,
        };
      }
      return { configured: false };
    } catch {
      return { configured: false };
    }
  },

  uploadMediaAsset: async (formData: FormData) => {
    // Media upload uses multipart/form-data directly through proxy
    const res = await fetch('/api/proxy/user/return_media_url_meta', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return data;
  },

  // ── Local Baileys / Quick Replies Presets ─────────────────────────────────
  getLocalTemplates: async () => {
    return api.get<{ success: boolean; data: LocalTemplate[] }>('/api/templet/get_templets');
  },

  createLocalTemplate: async (payload: { title: string; type: string; content: any }) => {
    return api.post<{ success: boolean; msg: string }>('/api/templet/add_new', payload);
  },

  deleteLocalTemplates: async (selected: number[]) => {
    return api.post<{ success: boolean; msg: string }>('/api/templet/del_templets', { selected });
  },
};
