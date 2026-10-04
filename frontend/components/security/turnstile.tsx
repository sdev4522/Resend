'use client';

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
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
          'error-callback'?: (code?: string) => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
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
  action?: string;
  className?: string;
}

// Fallback to Cloudflare's official always-pass testing key in development if env is not set
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onSuccess, onError, onExpire, action = 'signup', className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const { resolvedTheme } = useTheme();

    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      (process.env.NODE_ENV !== 'production' ? DEFAULT_TEST_SITE_KEY : '');

    const reset = useCallback(() => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {}
      }
    }, []);

    useImperativeHandle(ref, () => ({
      reset,
    }), [reset]);

    useEffect(() => {
      let isMounted = true;

      if (!siteKey) {
        console.warn('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY.');
        return;
      }

      const renderWidget = () => {
        if (!isMounted || !containerRef.current || !window.turnstile) return;

        // Clean up any previous widget instance
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }

        try {
          const themeMode = resolvedTheme === 'dark' ? 'dark' : resolvedTheme === 'light' ? 'light' : 'auto';

          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme: themeMode,
            callback: (token: string) => {
              if (isMounted) {
                onSuccess(token);
              }
            },
            'error-callback': (code?: string) => {
              if (isMounted) {
                onError?.(code);
              }
            },
            'expired-callback': () => {
              if (isMounted) {
                onExpire?.();
              }
            },
          });
        } catch (err) {
          console.error('[Turnstile] Render error:', err);
          onError?.('RENDER_ERROR');
        }
      };

      // Load script if not already present
      if (typeof window !== 'undefined') {
        if (window.turnstile) {
          renderWidget();
        } else {
          let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
          if (!script) {
            script = document.createElement('script');
            script.id = SCRIPT_ID;
            script.src = SCRIPT_URL;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
          }

          const onScriptLoad = () => {
            if (isMounted && window.turnstile) {
              renderWidget();
            }
          };

          script.addEventListener('load', onScriptLoad);

          return () => {
            isMounted = false;
            script?.removeEventListener('load', onScriptLoad);
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
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, action, resolvedTheme, onSuccess, onError, onExpire]);

    if (!siteKey) {
      return null;
    }

    return (
      <div
        className={`flex justify-center items-center min-h-[65px] my-1 transition-opacity duration-200 ${
          className || ''
        }`}
      >
        <div ref={containerRef} className="cf-turnstile-container" />
      </div>
    );
  }
);

Turnstile.displayName = 'Turnstile';

export default Turnstile;
