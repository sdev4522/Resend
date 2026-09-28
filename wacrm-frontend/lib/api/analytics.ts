import { api } from './client';
import {
  UserWorkspaceAnalytics,
  AdminPlatformAnalytics,
  AdminUserDetails,
  AnalyticsRange,
  AnalyticsFilterParams,
} from '@/types/analytics';

export const analyticsApi = {
  /**
   * Fetch authenticated user workspace analytics with date and instance scoping
   */
  async getUserAnalytics(
    params?: AnalyticsFilterParams | AnalyticsRange
  ): Promise<UserWorkspaceAnalytics> {
    let queryParams: Record<string, string | undefined> = {};

    if (typeof params === 'string') {
      queryParams = { range: params };
    } else if (params && typeof params === 'object') {
      queryParams = {
        range: params.range || '7d',
        startDate: params.startDate,
        endDate: params.endDate,
        instanceId: params.instanceId && params.instanceId !== 'all' ? params.instanceId : undefined,
      };
    } else {
      queryParams = { range: '7d' };
    }

    const res = await api.get<{ success: boolean; data: UserWorkspaceAnalytics }>(
      '/user/analytics',
      { params: queryParams }
    );
    if (!res?.success || !res.data) {
      throw new Error('Failed to load user analytics');
    }
    return res.data;
  },

  /**
   * Fetch platform-wide administrative analytics (God Mode)
   */
  async getAdminAnalytics(
    params?: { range?: AnalyticsRange; startDate?: string; endDate?: string } | AnalyticsRange
  ): Promise<AdminPlatformAnalytics> {
    let queryParams: Record<string, string | undefined> = {};

    if (typeof params === 'string') {
      queryParams = { range: params };
    } else if (params && typeof params === 'object') {
      queryParams = {
        range: params.range || '30d',
        startDate: params.startDate,
        endDate: params.endDate,
      };
    } else {
      queryParams = { range: '30d' };
    }

    const res = await api.get<{ success: boolean; data: AdminPlatformAnalytics }>(
      '/admin/analytics',
      { params: queryParams }
    );
    if (!res?.success || !res.data) {
      throw new Error('Failed to load platform analytics');
    }
    return res.data;
  },

  /**
   * Fetch detailed user inspector data for admin
   */
  async getUserDetails(uid: string): Promise<AdminUserDetails> {
    const res = await api.get<{ success: boolean; data: AdminUserDetails }>(
      `/admin/get_user_details?uid=${encodeURIComponent(uid)}`
    );
    if (!res?.success || !res.data) {
      throw new Error('Failed to load user details');
    }
    return res.data;
  },
};
