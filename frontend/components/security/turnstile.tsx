'use client';

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

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
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          retry?: 'auto' | 'never';
          'refresh-expired'?: 'auto' | 'manual';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export interface TurnstileRef {
  reset: () => void;
}

export interface TurnstileProps {
  onSuccess: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  onTimeout?: () => void;
  action?: string;
  className?: string;
}

// Fallback to Cloudflare's official always-pass testing key if env is not configured
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Watchdog timer in milliseconds to prevent endless stuck "Verifying..." state
const VERIFICATION_TIMEOUT_MS = 15000;

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onSuccess, onError, onExpire, onTimeout, action = 'signup', className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isRenderingRef = useRef<boolean>(false);
    const { resolvedTheme } = useTheme();

    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired' | 'timeout'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Keep callbacks in stable refs so parent re-renders (e.g. typing) do not recreate the widget
    const callbacksRef = useRef({ onSuccess, onError, onExpire, onTimeout });
    useEffect(() => {
      callbacksRef.current = { onSuccess, onError, onExpire, onTimeout };
    });

    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY;

    const clearWatchdog = useCallback(() => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    }, []);

    const reset = useCallback(() => {
      clearWatchdog();
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus('loading');
          setErrorMessage(null);
          return;
        } catch {}
      }
      // If widget reset failed or widgetId is missing, trigger clean retry
      setStatus('loading');
      setErrorMessage(null);
    }, [clearWatchdog]);

    useImperativeHandle(ref, () => ({
      reset,
    }), [reset]);

    const renderWidget = useCallback(() => {
      if (!containerRef.current || isRenderingRef.current) return;

      const turnstile = window.turnstile;
      if (!turnstile || typeof turnstile.render !== 'function') return;

      isRenderingRef.current = true;

      // Clean up previous widget instance if present
      if (widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      // Ensure container has no leftover DOM children from previous render attempts
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      clearWatchdog();
      setStatus('loading');
      setErrorMessage(null);

      // Start watchdog timer to prevent infinite stuck "Verifying..." spinner
      watchdogTimerRef.current = setTimeout(() => {
        setStatus((prevStatus) => {
          if (prevStatus === 'loading') {
            const timeoutMsg = 'Verification took too long to complete. Please retry.';
            setErrorMessage(timeoutMsg);
            callbacksRef.current.onTimeout?.();
            callbacksRef.current.onError?.('TIMEOUT');
            return 'timeout';
          }
          return prevStatus;
        });
      }, VERIFICATION_TIMEOUT_MS);

      try {
        const themeMode = resolvedTheme === 'dark' ? 'dark' : resolvedTheme === 'light' ? 'light' : 'auto';

        const id = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: themeMode,
          retry: 'auto',
          'refresh-expired': 'auto',
          callback: (token: string) => {
            clearWatchdog();
            setStatus('success');
            setErrorMessage(null);
            callbacksRef.current.onSuccess(token);
          },
          'error-callback': (code?: string) => {
            clearWatchdog();
            setStatus('error');
            const errorText = code
              ? `Verification encountered an error (${code}). Please retry.`
              : 'Security verification failed. Please try again.';
            setErrorMessage(errorText);
            callbacksRef.current.onError?.(code);
          },
          'expired-callback': () => {
            clearWatchdog();
            setStatus('expired');
            setErrorMessage('Verification token expired. Please retry.');
            callbacksRef.current.onExpire?.();
          },
          'timeout-callback': () => {
            clearWatchdog();
            setStatus('timeout');
            setErrorMessage('Verification challenge timed out. Please retry.');
            callbacksRef.current.onTimeout?.();
            callbacksRef.current.onError?.('TIMEOUT');
          },
        });

        widgetIdRef.current = id;
      } catch (err: any) {
        clearWatchdog();
        console.error('[Turnstile] Render error:', err);
        setStatus('error');
        setErrorMessage('Failed to initialize verification challenge.');
        callbacksRef.current.onError?.('RENDER_ERROR');
      } finally {
        isRenderingRef.current = false;
      }
    }, [siteKey, action, resolvedTheme, clearWatchdog]);

    // Handle manual retry trigger by user
    const handleRetry = useCallback(() => {
      setStatus('loading');
      setErrorMessage(null);
      renderWidget();
    }, [renderWidget]);

    useEffect(() => {
      let isMounted = true;

      if (!siteKey) {
        console.warn('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY.');
        setStatus('error');
        setErrorMessage('Turnstile site key is not configured.');
        return;
      }

      const initTurnstile = () => {
        if (!isMounted) return;
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          renderWidget();
        }
      };

      if (typeof window !== 'undefined') {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          initTurnstile();
        } else {
          let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
          if (!script) {
            script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.src = SCRIPT_URL;
            // Cloudflare Turnstile prohibits async/defer attributes when explicit render is used
            document.head.appendChild(script);
          }

          const onScriptLoad = () => {
            if (isMounted) {
              initTurnstile();
            }
          };

          const onScriptError = () => {
            if (isMounted) {
              clearWatchdog();
              setStatus('error');
              setErrorMessage('Could not load security verification script. Please check your connection or ad blocker.');
              callbacksRef.current.onError?.('SCRIPT_LOAD_ERROR');
            }
          };

          script.addEventListener('load', onScriptLoad);
          script.addEventListener('error', onScriptError);

          // In case the script was already loaded by a previous navigation
          if (window.turnstile && typeof window.turnstile.render === 'function') {
            initTurnstile();
          }

          return () => {
            isMounted = false;
            script?.removeEventListener('load', onScriptLoad);
            script?.removeEventListener('error', onScriptError);
            clearWatchdog();
            if (widgetIdRef.current && window.turnstile) {
              try {
                window.turnstile.remove(widgetIdRef.current);
              } catch {}
              widgetIdRef.current = null;
            }
          };
        }
      }

      return () => {
        isMounted = false;
        clearWatchdog();
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    // Only re-initialize if siteKey or action truly changes; callbacks are referenced safely via ref
    }, [siteKey, action, renderWidget, clearWatchdog]);

    return (
      <div
        className={`flex flex-col justify-center items-center min-h-[65px] my-1 transition-opacity duration-200 ${
          className || ''
        }`}
      >
        {/* Turnstile explicit rendering container */}
        <div
          ref={containerRef}
          className={`cf-turnstile-container ${status === 'error' || status === 'timeout' ? 'hidden' : 'block'}`}
        />

        {/* Loading state indicator before Turnstile iframe renders */}
        {status === 'loading' && !widgetIdRef.current && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Verifying security check...</span>
          </div>
        )}

        {/* Error or Timeout state with user-facing recovery action */}
        {(status === 'error' || status === 'timeout' || status === 'expired') && (
          <div className="flex flex-col items-center gap-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs max-w-sm w-full text-center">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage || 'Verification failed'}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
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
