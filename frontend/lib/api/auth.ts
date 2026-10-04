import { api } from './client';
import { LoginPayload, RegisterPayload, ForgotPasswordPayload, ResetPasswordPayload, AuthResponse } from '@/types/auth';
import { User } from '@/types/user';

export const authApi = {
  login: (credentials: LoginPayload & { role?: 'user' | 'agent' | 'admin' }) => {
    return api.post<AuthResponse>('/api/auth/login', credentials);
  },

  register: (payload: RegisterPayload & { mobile_with_country_code?: string; acceptPolicy?: boolean; turnstileToken?: string }) => {
    return api.post<AuthResponse>('/api/auth/register', {
      ...payload,
      mobile_with_country_code: payload.mobile_with_country_code || payload.phone,
      acceptPolicy: payload.acceptPolicy ?? true,
      turnstileToken: payload.turnstileToken,
    });
  },

  getMe: () => {
    return api.get<{ success: boolean; user: User; role: any; workspace: any }>('/api/auth/me');
  },

  forgotPassword: (payload: ForgotPasswordPayload) => {
    return api.post<{ success: boolean; msg: string }>('/api/auth/forgot-password', payload);
  },

  resetPassword: (payload: ResetPasswordPayload) => {
    return api.post<{ success: boolean; msg: string }>('/api/auth/reset-password', payload);
  },

  verifyEmail: (payload: { email: string; otp: string }) => {
    return api.post<AuthResponse>('/api/auth/verify-email', payload);
  },

  resendVerification: (payload: { email: string }) => {
    return api.post<{ success: boolean; msg: string; cooldown?: number }>('/api/auth/resend-verification', payload);
  },

  logout: () => {
    return api.post<{ success: boolean }>('/api/auth/logout');
  },
};

