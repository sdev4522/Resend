'use client';

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '@/lib/socket/client';
import { useAuth } from '@/lib/auth/auth-context';

export function useSocket() {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      disconnectSocket();
      setIsConnected(false);
      setSocket(null);
      return;
    }

    let currentS: Socket | null = null;
    const handleConnect = () => {
      if (active) setIsConnected(true);
    };
    const handleDisconnect = () => {
      if (active) setIsConnected(false);
    };

    connectSocket().then((s) => {
      if (!active || !s) return;
      currentS = s;
      setSocket(s);

      s.on('connect', handleConnect);
      s.on('disconnect', handleDisconnect);

      if (s.connected) {
        setIsConnected(true);
      }
    });

    return () => {
      active = false;
      if (currentS) {
        currentS.off('connect', handleConnect);
        currentS.off('disconnect', handleDisconnect);
      }
    };
  }, [isAuthenticated]);

  return { socket, isConnected };
}
