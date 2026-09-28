import { api } from './client';
import { API_ENDPOINTS } from '@/config/api';
import {
  ApiKey,
  CreateApiKeyInput,
  ApiKeyCreatedResult,
  DeveloperConnection,
  DeveloperLimits,
  DeveloperStats,
} from '@/types/developer';

export const developerApi = {
  getKeys: () => {
    return api.get<{
      success: boolean;
      data: ApiKey[];
    }>(API_ENDPOINTS.developer.keys);
  },

  createKey: (payload: CreateApiKeyInput) => {
    return api.post<{
      success: boolean;
      data: ApiKeyCreatedResult;
    }>(API_ENDPOINTS.developer.keys, payload);
  },

  revokeKey: (id: number | string) => {
    return api.delete<{
      success: boolean;
      msg?: string;
    }>(API_ENDPOINTS.developer.revokeKey(id));
  },

  getConnections: () => {
    return api.get<{
      success: boolean;
      data: DeveloperConnection[];
    }>(API_ENDPOINTS.developer.connections);
  },

  getLimits: () => {
    return api.get<{
      success: boolean;
      data: DeveloperLimits;
    }>(API_ENDPOINTS.developer.limits);
  },

  getStats: (period?: string) => {
    return api.get<{
      success: boolean;
      data: DeveloperStats;
    }>(API_ENDPOINTS.developer.stats, {
      params: period ? { period } : undefined,
    });
  },
};
