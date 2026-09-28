import { api } from '@/lib/api/client';
import { MetaPublicConfig, MetaConnection, MetaEmbeddedSignupResult } from '@/types/meta';

export const metaApi = {
  /**
   * Fetch safe Meta Embedded Signup public config (app ID, config ID, version)
   * Never contains or exposes the App Secret
   */
  async getPublicConfig(): Promise<{ success: boolean; data: MetaPublicConfig }> {
    const res = await api.get<{ success: boolean; data: MetaPublicConfig }>('/api/user/get_embed_keys');
    return {
      success: res.success ?? true,
      data: {
        embed_app_id: res.data?.embed_app_id || null,
        embed_app_config: res.data?.embed_app_config || null,
        graph_version: (res.data as any)?.graph_version || 'v21.0',
        configured: Boolean(res.data?.embed_app_id && res.data?.embed_app_config),
      },
    };
  },

  /**
   * Fetch existing Meta credentials / WABA connection for authenticated user
   */
  async getConnection(): Promise<{ success: boolean; data: MetaConnection | null }> {
    const res = await api.get<{ success: boolean; data: MetaConnection }>('/api/user/get_meta_keys');
    const hasData = res.data && (res.data.waba_id || res.data.business_phone_number_id);
    return {
      success: res.success ?? true,
      data: hasData ? res.data : null,
    };
  },

  /**
   * Complete Embedded Signup by sending auth code & WABA metadata to backend for token exchange
   */
  async exchangeEmbedToken(payload: MetaEmbeddedSignupResult): Promise<{ success: boolean; msg: string; data?: any }> {
    return api.post<{ success: boolean; msg: string; data?: any }>('/api/user/exchange_embed_token', payload);
  },

  /**
   * Disconnect WhatsApp Business account from this workspace
   */
  async disconnect(): Promise<{ success: boolean; msg: string }> {
    return api.post<{ success: boolean; msg: string }>('/api/user/disconnect_meta');
  },
};

export default metaApi;
