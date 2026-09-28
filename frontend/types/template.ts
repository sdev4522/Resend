export type MetaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type MetaTemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export type MetaHeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export type MetaButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface MetaTemplateButton {
  type: MetaButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface MetaTemplateComponentHeader {
  type: 'HEADER';
  format: MetaHeaderFormat;
  text?: string;
  example?: {
    header_handle?: string[];
    header_text?: string[];
  };
}

export interface MetaTemplateComponentBody {
  type: 'BODY';
  text: string;
  example?: {
    body_text?: string[][];
  };
}

export interface MetaTemplateComponentFooter {
  type: 'FOOTER';
  text: string;
}

export interface MetaTemplateComponentButtons {
  type: 'BUTTONS';
  buttons: MetaTemplateButton[];
}

export type MetaTemplateComponent =
  | MetaTemplateComponentHeader
  | MetaTemplateComponentBody
  | MetaTemplateComponentFooter
  | MetaTemplateComponentButtons;

export interface MetaTemplateVariable {
  component: 'HEADER' | 'BODY' | 'BUTTON';
  index: string | number;
  buttonType?: string;
  type?: string;
  example?: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: MetaTemplateStatus;
  category: MetaTemplateCategory;
  components: MetaTemplateComponent[];
  rejected_reason?: string;
  quality_score?: {
    score: string;
  };
  variables?: MetaTemplateVariable[];
}

export interface LocalTemplate {
  id: number;
  uid: string;
  title: string;
  type: string;
  content: string | any;
  createdAt: string;
}

export interface MetaConnectionStatus {
  configured: boolean;
  waba_id?: string;
  business_phone_number_id?: string;
  app_id?: string;
  login_type?: string;
}

export interface CreateMetaTemplatePayload {
  name: string;
  category: MetaTemplateCategory;
  language: string;
  components: MetaTemplateComponent[];
}
