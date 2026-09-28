export type MetaConnectionState =
  | 'IDLE'
  | 'LOADING_CONFIG'
  | 'LAUNCHING'
  | 'EMBEDDED_SIGNUP'
  | 'PROCESSING'
  | 'CONNECTED'
  | 'CANCELLED'
  | 'ERROR';

export interface MetaPublicConfig {
  embed_app_id: string | null;
  embed_app_config: string | null;
  graph_version: string;
  configured: boolean;
}

export interface AdminMetaConfig {
  appId: string;
  configId: string;
  graphVersion: string;
  hasAppSecret: boolean;
  appSecret?: string;
}

export interface MetaConnection {
  id?: number;
  uid?: string;
  waba_id?: string | null;
  business_account_id?: string | null;
  business_phone_number_id?: string | null;
  app_id?: string | null;
  createdAt?: string;
  login_type?: 'manual' | 'embed' | string;
  is_coexistence?: boolean | number;
  platform_type?: string | null;
  embed_data?: string | Record<string, any> | null;
}

export interface MetaEmbeddedSignupResult {
  authCode: string;
  wabaId: string;
  phoneNumId: string;
  businessId?: string;
  isCoexistence?: boolean;
}
