'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole } from '@/types/user';
import {
  AuthContextType,
  AuthStatus,
  LoginPayload,
  RegisterPayload,
  WorkspaceContextType,
} from '@/types/auth';
import { authApi } from '@/lib/api/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceContextType | null>(null);
  const [status, setStatus] = useState<AuthStatus>('AUTHENTICATING');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setRole(null);
    setWorkspace(null);
    setStatus('UNAUTHENTICATED');

    // Only redirect if current path is a protected route
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const isPublicPath =
        path === '/' ||
        path === '/pricing' ||
        path === '/features' ||
        path === '/login' ||
        path === '/register' ||
        path === '/forgot-password' ||
        path === '/admin/login';

      if (!isPublicPath) {
        if (path.startsWith('/admin')) {
          router.push('/admin/login?error=session_expired');
        } else {
          router.push('/login?error=session_expired');
        }
      }
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        setRole(res.role || res.user.role || 'user');
        setWorkspace(res.workspace || {
          id: res.user.uid,
          name: `${res.user.name || 'My'}'s Workspace`,
          ownerUid: res.user.uid,
          role: res.role || res.user.role || 'user',
          isOwner: (res.role || res.user.role) === 'user',
        });
        setStatus('AUTHENTICATED');
        setError(null);
      } else {
        setUser(null);
        setRole(null);
        setWorkspace(null);
        setStatus('UNAUTHENTICATED');
      }
    } catch {
      setUser(null);
      setRole(null);
      setWorkspace(null);
      setStatus('UNAUTHENTICATED');
    }
  }, []);

  // Initial session check on mount
  useEffect(() => {
    refreshUser();

    window.addEventListener('wacrm:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('wacrm:unauthorized', handleUnauthorized);
    };
  }, [refreshUser, handleUnauthorized]);

  const login = async (credentials: LoginPayload) => {
    setStatus('AUTHENTICATING');
    setError(null);
    try {
      const res = await authApi.login(credentials);
      if (res.success && res.user) {
        setUser(res.user);
        setRole(res.role || res.user.role || 'user');
        setStatus('AUTHENTICATED');
        await refreshUser();

        // Redirect based on backend role
        if (res.role === 'admin') {
          router.push('/admin');
        } else if (!res.user.timezone) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      } else {
        throw new Error(res.msg || 'Invalid email or password');
      }
    } catch (err: any) {
      setStatus('AUTH_ERROR');
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const register = async (payload: RegisterPayload) => {
    setStatus('AUTHENTICATING');
    setError(null);
    try {
      const res = await authApi.register(payload);
      if (res.success) {
        setStatus('UNAUTHENTICATED');
        return {
          email_verification_required: res.email_verification_required,
          email: res.email || payload.email,
        };
      } else {
        throw new Error(res.msg || 'Registration failed');
      }
    } catch (err: any) {
      setStatus('AUTH_ERROR');
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const verifyEmail = async (payload: { email: string; otp: string }) => {
    setStatus('AUTHENTICATING');
    setError(null);
    try {
      const res = await authApi.verifyEmail(payload);
      if (res.success && res.user) {
        setUser(res.user);
        setRole('user');
        setStatus('AUTHENTICATED');
        await refreshUser();
        return res;
      } else {
        throw new Error(res.msg || 'Verification failed');
      }
    } catch (err: any) {
      setStatus('AUTH_ERROR');
      setError(err.message || 'Verification failed');
      throw err;
    }
  };

  const resendVerification = async (payload: { email: string }) => {
    try {
      return await authApi.resendVerification(payload);
    } catch (err: any) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setRole(null);
      setWorkspace(null);
      setStatus('UNAUTHENTICATED');
      setError(null);
      router.push('/login');
    }
  };

  const hasRole = (allowedRoles: UserRole | UserRole[]): boolean => {
    if (!role) return false;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(role);
    }
    return role === allowedRoles;
  };

  const canAccess = (permission: string): boolean => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (role === 'user') return true;
    if (role === 'agent') {
      const agentAllowed = ['inbox', 'chat', 'quick_reply', 'task'];
      return agentAllowed.includes(permission);
    }
    return false;
  };

  const isAuthenticated = status === 'AUTHENTICATED' && !!user;
  const isLoading = status === 'AUTHENTICATING';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        workspace,
        status,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
        refreshUser,
        hasRole,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useWorkspace(): WorkspaceContextType | null {
  const { workspace } = useAuth();
  return workspace;
}
