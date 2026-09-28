import { api } from './client';
import { AdminProfileData } from '@/types/admin';

export interface UserProfileData {
  id: number;
  uid: string;
  name: string;
  email: string;
  mobile_with_country_code: string;
  timezone: string;
  role: 'user' | 'agent' | 'admin';
  plan?: string | null;
  plan_expire?: string | null;
  trial?: number;
  createdAt?: string;
  contact?: number;
}

export interface UpdateUserProfilePayload {
  name: string;
  email: string;
  mobile_with_country_code: string;
  timezone: string;
  newPassword?: string;
}

export interface UpdateAdminProfilePayload {
  email: string;
  newpass?: string;
}

export const profileApi = {
  getUserProfile: () => {
    return api.get<{ success: boolean; data: UserProfileData; addon?: string[] }>('/api/user/get_me');
  },

  updateUserProfile: (payload: UpdateUserProfilePayload) => {
    return api.post<{ success: boolean; msg: string }>('/api/user/update_profile', payload);
  },

  getAdminProfile: () => {
    return api.get<{ success: boolean; data: AdminProfileData }>('/api/admin/get_admin');
  },

  updateAdminProfile: (payload: UpdateAdminProfilePayload) => {
    return api.post<{ success: boolean; msg: string }>('/api/admin/update-admin', payload);
  },
};
