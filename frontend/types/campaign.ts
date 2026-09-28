export type CampaignStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'FAILED';

export interface Campaign {
  campaign_id: string;
  uid: string;
  title: string;
  template_name: string;
  template_language: string;
  template_type?: string;
  phonebook_id: number;
  phonebook_name?: string;
  status: CampaignStatus;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  schedule?: string | null;
  timezone?: string | null;
  createdAt: string;
}

export interface CampaignLog {
  id: number;
  campaign_id: string;
  contact_name: string;
  contact_mobile: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null;
  createdAt: string;
  delivery_time?: string | null;
  error_message?: string | null;
  meta_msg_id?: string | null;
}

export interface CampaignPagination {
  currentPage: number;
  totalPages: number;
  totalCampaigns: number;
  limit: number;
}

export interface GetCampaignsParams extends Record<string, string | number | boolean | undefined> {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface CreateTemplateCampaignPayload {
  campaign_title: string;
  template_name: string;
  template_language: string;
  template_type?: 'STANDARD' | 'CAROUSEL' | 'CATALOG';
  phonebook_id: number;
  body_variables?: string[] | Record<string, string>;
  header_variable?: {
    type?: 'image' | 'video' | 'document';
    url?: string;
    filename?: string;
  } | null;
  button_variables?: string[];
  schedule?: string | null;
  timezone?: string;
}
