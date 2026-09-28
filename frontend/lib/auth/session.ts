export const SESSION_COOKIE_NAME = 'wacrm_session';
export const ROLE_COOKIE_NAME = 'wacrm_role';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface JWTPayload {
  uid: string;
  role: 'user' | 'agent' | 'admin';
  owner_uid?: string;
  tokenVersion?: number;
  email?: string;
  exp?: number;
  iat?: number;
}

export function parseJwt(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('binary')
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}
