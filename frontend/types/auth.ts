import { User, UserRole } from './user';

export type AuthStatus =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'AUTH_ERROR';

export interface LoginPayload {
  email: string;
  password: string;
  role?: UserRole;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  mobile_with_country_code?: string;
  acceptPolicy?: boolean;
  timezone?: string;
  turnstileToken?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface VerifyEmailPayload {
  email: string;
  otp: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  role?: UserRole;
  msg?: string;
  message?: string;
  email_verification_required?: boolean;
  email_unverified?: boolean;
  email?: string;
  already_verified?: boolean;
}

export interface WorkspaceContextType {
  id: string;
  name: string;
  ownerUid: string;
  role: UserRole;
  isOwner: boolean;
  contactCount?: number;
  plan?: any;
  planExpire?: string | null;
  addons?: string[];
  waConnected?: boolean;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  workspace: WorkspaceContextType | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ email_verification_required?: boolean; email?: string }>;
  verifyEmail: (payload: VerifyEmailPayload) => Promise<AuthResponse>;
  resendVerification: (payload: ResendVerificationPayload) => Promise<{ success: boolean; msg?: string; cooldown?: number }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  canAccess: (permission: string) => boolean;
}

