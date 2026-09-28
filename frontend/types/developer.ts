export type ApiScope =
  | 'messages:send'
  | 'messages:read'
  | 'contacts:read'
  | 'templates:read'
  | 'templates:send'
  | 'connections:read'
  | 'usage:read';

export interface ApiKey {
  id: number;
  uid: string;
  name: string;
  key_prefix: string;
  status: 'active' | 'revoked' | 'expired';
  scopes: ApiScope[];
  default_connection_id?: string | null;
  allowed_connections?: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiScope[];
  allowed_connections?: string[];
  default_connection_id?: string | null;
  expires_at?: string | null;
}

export interface ApiKeyCreatedResult extends ApiKey {
  secret: string;
}

export interface DeveloperConnection {
  id: string; // wa_01K...
  name: string;
  phone_number: string;
  provider: 'qr' | 'meta';
  status: 'connected' | 'disconnected';
}

export interface DeveloperLimits {
  requests_per_minute: number;
  messages_per_minute: number;
  workspace_requests_per_minute: number;
  monthly_quota: number;
  connections_limit: number;
  api_allowed: boolean;
}

export interface DeveloperStats {
  period: string;
  api_requests: number;
  messages: {
    accepted: number;
    sent: number;
    delivered: number;
    failed: number;
  };
}
