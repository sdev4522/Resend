import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '@/config/api';

let socket: Socket | null = null;
let currentToken: string | null = null;
let connectingPromise: Promise<Socket | null> | null = null;

export async function fetchSocketToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/socket-token', { credentials: 'same-origin' });
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

export function getSocket(token?: string | null): Socket {
  if (!socket) {
    socket = io(SOCKET_BASE_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      query: {
        token: token || '',
      },
    });
  }
  return socket;
}

export async function connectSocket(): Promise<Socket | null> {
  const token = await fetchSocketToken();
  if (!token) return null;

  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      if (socket) {
        socket.disconnect();
        socket = null;
      }

      currentToken = token;
      socket = io(SOCKET_BASE_URL, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
        query: {
          token,
        },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      return socket;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
    connectingPromise = null;
  }
}
