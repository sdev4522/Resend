import { MetaEmbeddedSignupResult } from '@/types/meta';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

const FB_SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';
const SCRIPT_ID = 'facebook-jssdk';

let sdkLoadingPromise: Promise<void> | null = null;

/**
 * Dynamically loads the Facebook / Meta JS SDK into the document head
 */
export function loadMetaSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.FB) {
    return Promise.resolve();
  }

  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise<void>((resolve, reject) => {
    // If script tag already exists in DOM
    if (document.getElementById(SCRIPT_ID)) {
      if (window.FB) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (window.FB) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = FB_SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      resolve();
    };

    script.onerror = (_err) => {
      sdkLoadingPromise = null;
      reject(new Error('Failed to load Meta JavaScript SDK. Please check your network or ad-blocker.'));
    };

    document.head.appendChild(script);
  });

  return sdkLoadingPromise;
}

/**
 * Initializes the Meta SDK with the given App ID and Graph API version
 */
export async function initMetaSdk(appId: string, graphVersion: string = 'v21.0'): Promise<void> {
  await loadMetaSdk();

  if (!window.FB) {
    throw new Error('Meta SDK failed to initialize');
  }

  window.FB.init({
    appId,
    cookie: true,
    xfbml: false,
    version: graphVersion || 'v21.0',
  });
}

/**
 * Launches the official Meta Embedded Signup flow
 */
export async function launchEmbeddedSignup(params: {
  appId: string;
  configId: string;
  graphVersion?: string;
}): Promise<MetaEmbeddedSignupResult> {
  await initMetaSdk(params.appId, params.graphVersion);

  return new Promise((resolve, reject) => {
    let capturedSessionData: {
      waba_id?: string;
      phone_number_id?: string;
      business_id?: string;
      current_step?: string;
    } | null = null;

    let isResolved = false;

    // 1. PostMessage listener for WA_EMBEDDED_SIGNUP events
    const messageHandler = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (payload?.type === 'WA_EMBEDDED_SIGNUP') {
          if (payload.event === 'FINISH') {
            capturedSessionData = payload.data || {};
          } else if (payload.event === 'CANCEL') {
            if (!isResolved) {
              isResolved = true;
              window.removeEventListener('message', messageHandler);
              reject(new Error('User cancelled Meta signup'));
            }
          } else if (payload.event === 'ERROR') {
            if (!isResolved) {
              isResolved = true;
              window.removeEventListener('message', messageHandler);
              reject(new Error(payload.data?.error_message || 'Meta signup failed'));
            }
          }
        }
      } catch {
        // Non-JSON message from other extensions or iframes
      }
    };

    window.addEventListener('message', messageHandler);

    // 2. Trigger official FB.login popup with Embedded Signup config
    try {
      window.FB.login(
        (response: any) => {
          window.removeEventListener('message', messageHandler);
          if (isResolved) return;
          isResolved = true;

          if (response?.authResponse?.code) {
            const authCode = response.authResponse.code;
            const wabaId = capturedSessionData?.waba_id || '';
            const phoneNumId = capturedSessionData?.phone_number_id || '';
            const businessId = capturedSessionData?.business_id || undefined;

            resolve({
              authCode,
              wabaId,
              phoneNumId,
              businessId,
              isCoexistence: false,
            });
          } else {
            // User closed popup or cancelled
            reject(new Error('Meta setup was cancelled or authorization was not granted.'));
          }
        },
        {
          config_id: params.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: '3',
          },
        }
      );
    } catch (err: any) {
      window.removeEventListener('message', messageHandler);
      reject(new Error(err.message || 'Failed to open Meta Embedded Signup popup. Please allow popups.'));
    }
  });
}
