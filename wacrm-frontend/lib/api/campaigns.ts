import { api } from './client';
import {
  Campaign,
  CampaignLog,
  CampaignPagination,
  GetCampaignsParams,
  CreateTemplateCampaignPayload,
} from '@/types/campaign';

export const campaignsApi = {
  getCampaigns: (params?: GetCampaignsParams) => {
    return api.get<{
      success: boolean;
      campaigns: Campaign[];
      pagination: CampaignPagination;
      error?: string;
    }>('/api/broadcast/campaigns', { params });
  },

  createTemplateCampaign: (payload: CreateTemplateCampaignPayload) => {
    return api.post<{
      success: boolean;
      msg?: string;
      campaignId?: string;
      error?: string;
    }>('/api/broadcast/create_template_campaign', payload);
  },

  getCampaignDetail: (campaignId: string) => {
    return api.get<{
      success: boolean;
      campaign: Campaign;
      stats: any[];
      logs: CampaignLog[];
      error?: string;
    }>(`/api/broadcast/campaign/${campaignId}`);
  },

  deleteCampaign: (id: string) => {
    return api.post<{ success: boolean; msg?: string; error?: string }>(
      '/api/broadcast/del_campaign',
      { id }
    );
  },

  changeCampaignStatus: (broadcast_id: string, status: string) => {
    return api.post<{ success: boolean; msg?: string }>(
      '/api/broadcast/change_broadcast_status',
      { broadcast_id, status }
    );
  },
};
