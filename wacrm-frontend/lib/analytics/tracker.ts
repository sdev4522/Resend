/**
 * WaCRM Privacy-Compliant Public Analytics & Telemetry Tracker
 * Strictly adheres to cookie consent choices and never tracks sensitive user data.
 */

export type AnalyticsEvent =
  | 'page_view'
  | 'cta_click'
  | 'contact_submit_attempt'
  | 'contact_submit_success'
  | 'contact_submit_fail'
  | 'auth_dialog_open'
  | 'cookie_consent_accepted'
  | 'cookie_consent_declined';

const CONSENT_STORAGE_KEY = 'wacrm_cookie_consent';

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const consent = localStorage.getItem(CONSENT_STORAGE_KEY);
    return consent === 'accepted';
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(value: 'accepted' | 'essential') {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent('wacrm_cookie_consent_change', { detail: value }));
  } catch {
    // Local storage disabled or error
  }
}

/**
 * Filter out any potentially sensitive fields before telemetry transmission
 */
function sanitizePayload(props: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const forbiddenPatterns = [
    /pass/i,
    /token/i,
    /secret/i,
    /auth/i,
    /key/i,
    /credit/i,
    /card/i,
    /cvv/i,
    /phone/i,
    /mobile/i,
  ];

  for (const [key, val] of Object.entries(props)) {
    const isSensitive = forbiddenPatterns.some((pattern) => pattern.test(key));
    if (!isSensitive) {
      if (typeof val === 'string' && val.length > 256) {
        sanitized[key] = val.slice(0, 256) + '...';
      } else {
        sanitized[key] = val;
      }
    }
  }

  return sanitized;
}

export function trackEvent(name: AnalyticsEvent, properties: Record<string, any> = {}) {
  if (!hasAnalyticsConsent()) {
    return;
  }

  const cleanPayload = sanitizePayload({
    ...properties,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
  });

  // If Google Analytics (gtag) is configured via env
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', name, cleanPayload);
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Analytics Track] ${name}`, cleanPayload);
  }
}

export function trackPageView(path: string) {
  if (!hasAnalyticsConsent()) {
    return;
  }

  const cleanPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/');

  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_path: cleanPath,
      page_title: typeof document !== 'undefined' ? document.title : '',
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Analytics PageView] ${cleanPath}`);
  }
}
