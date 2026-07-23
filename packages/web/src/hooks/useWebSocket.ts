import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useNotificationStore } from '../stores/notificationStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());
  const accessToken = useAuthStore((s) => s.accessToken);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const MAX_RECONNECT_ATTEMPTS = 10;

  const getReconnectDelay = useCallback(() => {
    return Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000) + Math.random() * 1000;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    const delay = getReconnectDelay();
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      const currentToken = useAuthStore.getState().accessToken;
      if (!currentToken) return;
      if (socketRef.current) {
        socketRef.current.auth = { token: currentToken };
        socketRef.current.connect();
      } else {
        connect();
      }
    }, delay);
  }, [getReconnectDelay]);

  const setupEventHandlers = useCallback((socket: Socket) => {
    socket.on('connect', () => {
      setConnectionState('connected');
      reconnectAttempts.current = 0;
      for (const roomId of joinedRooms.current) {
        socket.emit('join-group', { groupId: roomId });
      }
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        socket.disconnect();
        setConnectionState('disconnected');
      } else {
        setConnectionState('reconnecting');
        scheduleReconnect();
      }
    });

    socket.on('group-synced', (data: { groupId: string }) => {
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });
    socket.on('member-joined', (data: { groupId: string }) => {
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });
    socket.on('member-left', (data: { groupId: string }) => {
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });
    socket.on('passphrase-changed', (data: { groupId: string }) => {
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });

    socket.on('notification', (data: {
      id: string;
      type: string;
      title: string;
      body: string;
      groupId?: string;
      expenseId?: string;
      settlementId?: string;
      isRead: boolean;
      timestamp: string;
    }) => {
      useNotificationStore.getState().addNotification(data as any);
    });
  }, [scheduleReconnect]);

  const connect = useCallback(() => {
    const currentToken = useAuthStore.getState().accessToken;
    if (!currentToken) return;

    if (socketRef.current?.connected) return;

    setConnectionState('connecting');
    const socketUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

    socketRef.current = io(socketUrl, {
      auth: { token: currentToken },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000,
    });

    setupEventHandlers(socketRef.current);
  }, [setupEventHandlers]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    joinedRooms.current.clear();
    reconnectAttempts.current = 0;
    setConnectionState('disconnected');
  }, []);

  const joinGroupRoom = useCallback((groupId: string) => {
    joinedRooms.current.add(groupId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-group', { groupId });
    }
  }, []);

  const leaveGroupRoom = useCallback((groupId: string) => {
    joinedRooms.current.delete(groupId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-group', { groupId });
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [accessToken, connect, disconnect]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    joinGroupRoom,
    leaveGroupRoom,
    forceReconnect: () => {
      reconnectAttempts.current = 0;
      disconnect();
      setTimeout(() => connect(), 500);
    },
  };
}
