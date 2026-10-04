import { ApiResponse, ApiError } from '@/types/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private getProxyUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    if (cleanEndpoint.startsWith('api/auth/')) {
      return `/${cleanEndpoint}`;
    }
    if (cleanEndpoint.startsWith('api/proxy/')) {
      return `/${cleanEndpoint}`;
    }
    if (cleanEndpoint.startsWith('api/')) {
      return `/api/proxy/${cleanEndpoint.slice(4)}`;
    }
    return `/api/proxy/${cleanEndpoint}`;
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers = {}, ...customConfig } = options;

    let url = this.getProxyUrl(endpoint);

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }

    const isFormData = typeof FormData !== 'undefined' && customConfig.body instanceof FormData;
    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(headers as Record<string, string>),
    };
    if (!isFormData) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...customConfig,
        headers: requestHeaders,
      });

      const isAuthEndpoint =
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/verify-email') ||
        url.includes('/api/auth/forgot-password') ||
        url.includes('/api/auth/reset-password') ||
        url.includes('/api/auth/resend-verification');

      const data: ApiResponse<T> = await response.json().catch(() => ({
        success: false,
        msg: `HTTP error ${response.status}`,
      }));

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (!isAuthEndpoint) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wacrm:unauthorized'));
          }
          throw new ApiError(data.msg || data.message || 'Session expired. Please log in again.', 401, data, true);
        }
        throw new ApiError(data.msg || data.message || 'Invalid email or password', 401, data, false);
      }

      if (data.logout) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wacrm:unauthorized'));
        }
        throw new ApiError(data.msg || data.message || 'Session invalidated', 401, data, true);
      }

      if (!response.ok || (data && typeof data === 'object' && data.success === false)) {
        throw new ApiError(
          data?.msg || data?.message || data?.error || `HTTP error ${response.status}`,
          response.status,
          data
        );
      }

      return data as unknown as T;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Network request failed', 500);
    }
  }

  get<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { cache: 'no-store', ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  upload<T = any>(endpoint: string, formData: FormData, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }
}

export const api = new ApiClient();
export default api;
