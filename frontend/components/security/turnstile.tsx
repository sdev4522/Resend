'use client';

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'error-callback'?: (code?: string) => void | boolean;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          retry?: 'auto' | 'never';
          'retry-interval'?: number;
          'refresh-expired'?: 'auto' | 'manual';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    __cfTurnstileOnload__?: () => void;
  }
}

export interface TurnstileRef {
  reset: () => void;
  getToken: () => string | undefined;
}

export interface TurnstileProps {
  onSuccess: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  onTimeout?: () => void;
  action?: string;
  size?: 'normal' | 'compact' | 'flexible';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

// Fallback testing key from Cloudflare documentation for development/testing
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

const SCRIPT_ID = 'cf-turnstile-script';
const ONLOAD_CALLBACK_NAME = '__cfTurnstileOnload__';
const SCRIPT_URL = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${ONLOAD_CALLBACK_NAME}`;

// 15-second watchdog timer to catch network/browser stalls
const VERIFICATION_TIMEOUT_MS = 15000;

// Singleton script loader to guarantee script is loaded only once across modal opens/renders
let scriptLoadingPromise: Promise<void> | null = null;

function loadCloudflareTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }

  if (window.turnstile && typeof window.turnstile.render === 'function') {
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    // 1. Prepare global onload callback as documented by Cloudflare
    window[ONLOAD_CALLBACK_NAME] = () => {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        resolve();
      } else {
        scriptLoadingPromise = null;
        reject(new Error('Turnstile API was not initialized after script load'));
      }
    };

    // 2. Check if script tag already exists in DOM
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          resolve();
        }
      }, { once: true });
      existingScript.addEventListener('error', () => {
        scriptLoadingPromise = null;
        reject(new Error('Failed to load Turnstile script from Cloudflare'));
      }, { once: true });
      return;
    }

    // 3. Inject official Cloudflare Turnstile script
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;

    script.addEventListener('error', () => {
      scriptLoadingPromise = null;
      reject(new Error('Could not load security verification script. Please check your network or ad blocker.'));
    }, { once: true });

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onSuccess, onError, onExpire, onTimeout, action = 'signup', size = 'normal', theme, className }, ref) => {
    const { resolvedTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isRenderingRef = useRef<boolean>(false);
    const isMountedRef = useRef<boolean>(false);

    const [status, setStatus] = useState<
      'initializing' | 'verifying' | 'success' | 'error' | 'expired' | 'timeout'
    >('initializing');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Keep parent callbacks in stable ref to prevent unnecessary re-renderings
    const callbacksRef = useRef({ onSuccess, onError, onExpire, onTimeout });
    useEffect(() => {
      callbacksRef.current = { onSuccess, onError, onExpire, onTimeout };
    });

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY;

    const clearWatchdog = useCallback(() => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    }, []);

    const removeWidget = useCallback(() => {
      clearWatchdog();
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore removal exceptions during cleanup
        }
        widgetIdRef.current = null;
      }
    }, [clearWatchdog]);

    const renderWidget = useCallback(async () => {
      if (!isMountedRef.current || !containerRef.current || isRenderingRef.current) return;

      isRenderingRef.current = true;
      setStatus('initializing');
      setErrorMessage(null);

      // Clean up previous widget instance if present
      removeWidget();

      try {
        await loadCloudflareTurnstileScript();

        if (!isMountedRef.current || !containerRef.current) return;

        const turnstile = window.turnstile;
        if (!turnstile || typeof turnstile.render !== 'function') {
          throw new Error('Turnstile API unavailable');
        }

        setStatus('verifying');

        // Start watchdog timer
        clearWatchdog();
        watchdogTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('timeout');
            setErrorMessage('Verification timed out. Please click retry.');
            callbacksRef.current.onTimeout?.();
          }
        }, VERIFICATION_TIMEOUT_MS);

        const isDark =
          resolvedTheme === 'dark' ||
          (typeof document !== 'undefined' &&
            (document.documentElement.classList.contains('dark') ||
              document.body.classList.contains('dark')));

        const activeTheme: 'light' | 'dark' | 'auto' =
          theme || (isDark ? 'dark' : 'light');

        const id = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: activeTheme,
          size,
          retry: 'auto',
          'refresh-expired': 'auto',
          callback: (token: string) => {
            clearWatchdog();
            if (!isMountedRef.current) return;
            setStatus('success');
            setErrorMessage(null);
            callbacksRef.current.onSuccess(token);
          },
          'error-callback': (code?: string) => {
            clearWatchdog();
            if (!isMountedRef.current) return true;
            setStatus('error');
            let friendlyError = 'Security verification failed. Please try again.';
            if (code === '110200') {
              friendlyError = 'Current domain is not authorized for Turnstile. Please check Cloudflare settings.';
            } else if (code === '110100' || code === '110110') {
              friendlyError = 'Turnstile site key configuration error. Please verify the site key.';
            } else if (code === '110600' || code === '110620') {
              friendlyError = 'Verification challenge timed out. Please retry.';
            } else if (code?.startsWith('300') || code?.startsWith('600')) {
              friendlyError = 'Security verification could not be completed. Please retry.';
            } else if (code) {
              friendlyError = `Verification encountered an issue (${code}). Please retry.`;
            }
            setErrorMessage(friendlyError);
            callbacksRef.current.onError?.(code || 'CHALLENGE_FAILED');
            return true; // Return true to signal handled error per Cloudflare docs
          },
          'expired-callback': () => {
            clearWatchdog();
            if (!isMountedRef.current) return;
            setStatus('expired');
            setErrorMessage('Verification token expired. Please retry.');
            callbacksRef.current.onExpire?.();
          },
          'timeout-callback': () => {
            clearWatchdog();
            if (!isMountedRef.current) return;
            setStatus('timeout');
            setErrorMessage('Verification challenge timed out. Please retry.');
            callbacksRef.current.onTimeout?.();
          },
        });

        widgetIdRef.current = id;
      } catch (err: any) {
        clearWatchdog();
        if (isMountedRef.current) {
          setStatus('error');
          setErrorMessage(err.message || 'Could not load security verification.');
          callbacksRef.current.onError?.('SCRIPT_ERROR');
        }
      } finally {
        isRenderingRef.current = false;
      }
    }, [siteKey, action, size, theme, resolvedTheme, removeWidget, clearWatchdog]);

    const reset = useCallback(() => {
      clearWatchdog();
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus('verifying');
          setErrorMessage(null);
          watchdogTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setStatus('timeout');
              setErrorMessage('Verification timed out. Please click retry.');
              callbacksRef.current.onTimeout?.();
            }
          }, VERIFICATION_TIMEOUT_MS);
          return;
        } catch {
          // If reset throws, fall through to clean re-render
        }
      }
      renderWidget();
    }, [clearWatchdog, renderWidget]);

    useImperativeHandle(
      ref,
      () => ({
        reset,
        getToken: () => {
          if (widgetIdRef.current && window.turnstile) {
            try {
              return window.turnstile.getResponse(widgetIdRef.current);
            } catch {
              return undefined;
            }
          }
          return undefined;
        },
      }),
      [reset]
    );

    useEffect(() => {
      isMountedRef.current = true;
      renderWidget();

      return () => {
        isMountedRef.current = false;
        removeWidget();
      };
    }, [renderWidget, removeWidget]);

    return (
      <div
        className={`flex flex-col justify-center items-center min-h-[65px] my-1 transition-opacity duration-200 ${
          className || ''
        }`}
      >
        {/* Turnstile widget container */}
        <div
          ref={containerRef}
          className={`cf-turnstile-container flex justify-center items-center w-full min-h-[65px] ${
            status === 'error' || status === 'timeout' || status === 'expired'
              ? 'hidden'
              : 'flex'
          }`}
        />

        {/* Loading placeholder before Turnstile renders */}
        {status === 'initializing' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading security check...</span>
          </div>
        )}

        {/* Error / Timeout / Expired state with clear message and retry button */}
        {(status === 'error' || status === 'timeout' || status === 'expired') && (
          <div className="flex flex-col items-center gap-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs max-w-sm w-full text-center">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage || 'Verification failed'}</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-background text-foreground border hover:bg-accent transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Verification</span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
