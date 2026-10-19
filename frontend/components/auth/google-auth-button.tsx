'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
          cancel: () => void;
        };
        oauth2: {
          initCodeClient: (config: any) => {
            requestCode: () => void;
          };
          initTokenClient: (config: any) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

// Global singleton loader for Google Identity Services script
let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.google?.accounts?.id || window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

// Official Google Multi-Color SVG Icon
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.42l4.02-3.13z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  onSuccess?: () => void;
  onError?: (errorMessage: string) => void;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  disabled?: boolean;
  className?: string;
}

export function GoogleAuthButton({
  onSuccess,
  onError,
  text = 'continue_with',
  disabled = false,
  className,
}: GoogleAuthButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [config, setConfig] = useState<{ enabled: boolean; clientId: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // 1. Fetch public Google OAuth configuration
  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        const res = await authApi.getGoogleConfig();
        if (isMounted) {
          setConfig({
            enabled: res.success ? Boolean(res.enabled) : false,
            clientId: res.clientId || '',
          });
        }
      } catch {
        if (isMounted) {
          setConfig({ enabled: false, clientId: '' });
        }
      } finally {
        if (isMounted) {
          setLoadingConfig(false);
        }
      }
    }
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Handle Google Credential Response (ID Token)
  const handleCredentialResponse = useCallback(
    async (response: any) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setAuthenticating(true);
      setError(null);

      try {
        const idToken = response?.credential;
        if (!idToken) {
          throw new Error('Google identity token was not returned.');
        }

        await loginWithGoogle({ idToken });
        if (onSuccess) {
          onSuccess();
        }
      } catch (err: any) {
        const errMsg =
          err?.data?.msg ||
          err?.message ||
          'Google authentication could not be completed. Please try again.';
        setError(errMsg);
        if (onError) {
          onError(errMsg);
        }
      } finally {
        setAuthenticating(false);
        isSubmittingRef.current = false;
      }
    },
    [loginWithGoogle, onSuccess, onError]
  );

  // 3. Initialize Google Identity Services when config and script are ready
  useEffect(() => {
    if (!config?.enabled || !config.clientId) return;

    let isMounted = true;
    loadGoogleScript()
      .then(() => {
        if (!isMounted || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // If container exists, render Google official button into container
        if (containerRef.current) {
          // Clear any previous rendered children
          containerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(containerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: text === 'signup_with' ? 'signup_with' : text === 'signin_with' ? 'signin_with' : 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 384,
          });
        }
      })
      .catch((err) => {
        console.warn('Google Identity Services script load failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [config, handleCredentialResponse, text]);

  // Fallback trigger using Google Code Client or ID prompt if user clicks custom button
  const handleCustomClick = () => {
    if (disabled || authenticating || isSubmittingRef.current) return;
    setError(null);

    if (!config?.enabled || !config.clientId) {
      setError('Google Sign-In is not configured yet. Please configure it in Admin Settings.');
      return;
    }

    if (window.google?.accounts?.oauth2) {
      try {
        const codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: config.clientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          callback: async (response: any) => {
            if (response.code) {
              if (isSubmittingRef.current) return;
              isSubmittingRef.current = true;
              setAuthenticating(true);
              try {
                await loginWithGoogle({ code: response.code });
                if (onSuccess) onSuccess();
              } catch (err: any) {
                const errMsg = err?.data?.msg || err?.message || 'Google authentication failed.';
                setError(errMsg);
                if (onError) onError(errMsg);
              } finally {
                setAuthenticating(false);
                isSubmittingRef.current = false;
              }
            } else if (response.error) {
              setError(`Google Sign-In was cancelled or failed: ${response.error}`);
            }
          },
          error_callback: (err: any) => {
            if (err?.type !== 'popup_closed') {
              setError('Google Sign-In popup failed to open. Please check popup blockers.');
            }
          },
        });
        codeClient.requestCode();
        return;
      } catch (oauthErr: any) {
        console.error('Error initializing Google code client:', oauthErr);
      }
    }

    // If official button iframe is rendered inside container, trigger click on it
    if (containerRef.current) {
      const btn = containerRef.current.querySelector('div[role="button"]') as HTMLElement | null;
      if (btn) {
        btn.click();
        return;
      }
    }

    // Fallback: prompt Google One Tap
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const buttonLabel =
    text === 'signup_with'
      ? 'Sign up with Google'
      : text === 'signin_with'
      ? 'Sign in with Google'
      : 'Continue with Google';

  const isConfigured = Boolean(config?.enabled && config?.clientId);

  return (
    <div className="w-full space-y-2">
      {error && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Hidden container for Google Identity Services official iframe rendering */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className="hidden"
      />

      {/* Styled shadcn/ui Google Button matching design system */}
      <Button
        type="button"
        variant="outline"
        onClick={handleCustomClick}
        disabled={disabled || authenticating || loadingConfig}
        className={cn(
          'w-full h-10 px-4 text-sm font-medium border border-input bg-background hover:bg-accent/60 hover:text-accent-foreground text-foreground flex items-center justify-center gap-2.5 rounded-lg shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
        aria-label={buttonLabel}
      >
        {authenticating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span>Connecting with Google...</span>
          </>
        ) : loadingConfig ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>{buttonLabel}</span>
          </>
        )}
      </Button>

      {!loadingConfig && !isConfigured && (
        <p className="text-[11px] text-muted-foreground text-center">
          Google authentication is currently unconfigured.
        </p>
      )}
    </div>
  );
}

export default GoogleAuthButton;
