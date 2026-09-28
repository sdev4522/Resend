export type FlowSourceType =
  | 'wa_chatbot'
  | 'webhook_automation'
  | 'webhook_flow'
  | 'telegram_chatbot'
  | 'instagram_chatbot'
  | 'instagram_comment'
  | 'messenger_chatbot';

export type OriginCode =
  | 'META'
  | 'QR'
  | 'WEBHOOK_AUTOMATION'
  | 'TELEGRAM'
  | 'INSTAGRAM'
  | 'INSTAGRAM_COMMENT'
  | 'MESSENGER';

export interface OriginObject {
  title: string;
  code: OriginCode;
  data?: Record<string, any>;
}

export type AutomationStatus = 'active' | 'inactive' | 'draft' | 'error';

// Condition Node rule
export type ConditionOperator =
  | 'text_exact'
  | 'text_contains'
  | 'text_starts_with'
  | 'text_ends_with'
  | 'number_equals'
  | 'number_greater'
  | 'number_less'
  | 'number_between';

export interface ConditionRule {
  type: ConditionOperator;
  value: string;
  targetNodeId: string; // matches edge sourceHandle
  name: string;
  caseSensitive?: boolean;
}

// Flow Node Data Definitions
export type MessageSubtype =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'button'
  | 'list';

export interface ReplyButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface ListSectionRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListSectionRow[];
}

export interface InitialNodeData {
  whPhonePath?: string;
  sourceSlug?: string;
  sourceTitle?: string;
  [key: string]: any;
}

export interface MessageNodeData {
  moveToNextNode: boolean;
  type: {
    type: MessageSubtype;
    title: string;
  };
  content: {
    type: string;
    text?: {
      body: string;
      preview_url?: boolean;
    };
    image?: {
      link: string;
      caption?: string;
    };
    video?: {
      link: string;
      caption?: string;
    };
    audio?: {
      link: string;
    };
    document?: {
      link: string;
      caption?: string;
      filename?: string;
    };
    interactive?: {
      type: 'button' | 'list';
      header?: {
        type: 'text';
        text: string;
      };
      body: {
        text: string;
      };
      footer?: {
        text: string;
      };
      action: {
        button?: string; // List menu button title
        buttons?: ReplyButton[]; // Interactive buttons (up to 3)
        sections?: ListSection[]; // List sections
      };
    };
    [key: string]: any;
  };
  webhook?: Record<string, any>;
  [key: string]: any;
}

export interface ConditionNodeData {
  moveToNextNode: boolean;
  conditions: ConditionRule[];
  variable: {
    message: string;
    active: boolean;
  };
  [key: string]: any;
}

export interface DelayNodeData {
  moveToNextNode: boolean;
  seconds: number;
  [key: string]: any;
}

export interface WebhookHeaderParam {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface WebhookVariableMapping {
  varName: string;
  responsePath: string;
}

export interface MakeRequestNodeData {
  moveToNextNode: boolean;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: WebhookHeaderParam[];
  params?: WebhookHeaderParam[];
  contentType?: string;
  bodyInputMode?: 'visual' | 'raw';
  bodyData?: {
    json?: Array<{ key: string; value: string; enabled?: boolean }>;
    raw?: string;
  };
  variables?: WebhookVariableMapping[];
  [key: string]: any;
}

export interface ResponseSaverNodeData {
  moveToNextNode: boolean;
  variables: Array<{
    varName: string;
    responsePath: string;
  }>;
  [key: string]: any;
}

export interface SetChatLabelNodeData {
  moveToNextNode: boolean;
  labelsToAdd: Array<{
    id: number;
    title: string;
    hex: string;
  }>;
  [key: string]: any;
}

export interface PhonebookManagerNodeData {
  moveToNextNode: boolean;
  phonebook_id: number;
  phonebook_name?: string;
  action: 'add' | 'remove';
  [key: string]: any;
}

export interface AiTransferNodeData {
  moveToNextNode: boolean;
  assignedToAi: boolean;
  messageReferenceCount: number;
  instruction: string;
  model: string;
  [key: string]: any;
}

export interface WaTemplateNodeData {
  moveToNextNode: boolean;
  template: Record<string, any>;
  [key: string]: any;
}

export interface WaFormNodeData {
  moveToNextNode: boolean;
  waForm: Record<string, any>;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  ctaText?: string;
  [key: string]: any;
}

export type FlowNodeType =
  | 'INITIAL'
  | 'SEND_MESSAGE'
  | 'CONDITION'
  | 'DELAY'
  | 'MAKE_REQUEST'
  | 'RESPONSE_SAVER'
  | 'SET_CHAT_LABEL'
  | 'PHONEBOOK_MANAGER'
  | 'DISABLE_AUTOREPLY'
  | 'RESET'
  | 'AI_TRANSFER'
  | 'SEND_WA_TEMPLATE'
  | 'SEND_WA_FORM';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
  width?: number;
  height?: number;
  selected?: boolean;
  positionAbsolute?: { x: number; y: number };
  dragging?: boolean;
  [key: string]: any;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  animated?: boolean;
  style?: Record<string, any>;
  [key: string]: any;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Database representations
export interface BackendFlow {
  id: number;
  uid: string;
  flow_id: string;
  source: FlowSourceType;
  name: string;
  data: FlowData;
  is_active: number;
  createdAt: string;
}

export interface BackendChatbot {
  id: number;
  uid: string;
  source: FlowSourceType;
  title: string;
  flow_id: string;
  active: number; // 1 = active, 0 = inactive
  origin: string | OriginObject;
  origin_id: string;
  createdAt: string;
}

export interface FlowSession {
  id: number;
  uid: string;
  origin: string;
  origin_id: string;
  flow_id: string;
  sender_mobile: string;
  data: string | {
    node?: FlowNode;
    variables?: Record<string, any>;
    disableChat?: {
      timestamp: number;
      node: any;
    };
    aiTransfer?: {
      active: boolean;
      node: any;
    };
  };
  createdAt: string;
}

// Unified frontend presentation model
export interface AutomationItem {
  id: number;
  flow_id: string;
  name: string;
  description?: string;
  source: FlowSourceType;
  flowData: FlowData;
  status: AutomationStatus;
  chatbotId?: number;
  origin?: OriginObject;
  originId?: string;
  createdAt: string;
  sessionCount?: number;
}
