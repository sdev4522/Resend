export type QrConnectionState =
  | 'IDLE'
  | 'CREATING'
  | 'WAITING_FOR_QR'
  | 'QR_READY'
  | 'SCANNING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'EXPIRED'
  | 'CANCELLED';

export interface QrInstance {
  id: number;
  uid: string;
  title: string;
  number?: string | null;
  uniqueId: string;
  qr?: string | null;
  status: 'PENDING' | 'GENERATING' | 'ACTIVE' | 'INACTIVE' | string;
  createdAt?: string;
  data?: string | null;
  other?: string | null;
}

export interface QrCodeEvent {
  uniqueId: string;
  qr: string;
}

export interface QrConnectedEvent {
  uniqueId: string;
  number?: string | null;
  userData?: {
    id?: string;
    name?: string;
    [key: string]: any;
  };
}

export interface QrDisconnectedEvent {
  uniqueId: string;
  reason?: number | string;
  isPending?: boolean;
  cancelled?: boolean;
}

export interface QrErrorEvent {
  uniqueId?: string;
  message?: string;
  error?: string;
}
