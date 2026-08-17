import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useGroupStore } from '../stores/groupStore';
import { useNotificationStore } from '../stores/notificationStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

let roomActions: { join: (groupId: string) => void; leave: (groupId: string) => void } | null = null;

// Rooms requested before the socket layer is ready (e.g. a route component
// mounts before AppLayout's effect assigns roomActions, or before the socket
// connects). Kept at module level so the effect drains them once wired up.
const pendingRooms = new Set<string>();

export function joinGroupRoom(groupId: string): void {
  pendingRooms.add(groupId);
  roomActions?.join(groupId);
}

export function leaveGroupRoom(groupId: string): void {
  pendingRooms.delete(groupId);
  roomActions?.leave(groupId);
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());
  const accessToken = useAuthStore((s) => s.accessToken);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const MAX_RECONNECT_ATTEMPTS = 10;

  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnectRef = useRef<() => void>(() => {});

  const disconnect = useCallback((clearRooms = false) => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (clearRooms) joinedRooms.current.clear();
    reconnectAttempts.current = 0;
    setConnectionState('disconnected');
  }, []);

  const setupEventHandlers = useCallback((socket: Socket, sched: () => void) => {
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

    socket.on('connect_error', () => {
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        socket.disconnect();
        setConnectionState('disconnected');
      } else {
        setConnectionState('reconnecting');
        sched();
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
    socket.on('member-role-changed', (data: { groupId: string }) => {
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });
    socket.on('group-deleted', (data: { groupId: string }) => {
      useGroupStore.getState().removeGroupLocally(data.groupId);
      useGroupStore.getState().incrementGroupDataVersion(data.groupId);
    });
    socket.on('encryption-key-changed', (data: { groupId: string }) => {
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
  }, []);

  const connect = useCallback(() => {
    const currentToken = useAuthStore.getState().accessToken;
    if (!currentToken) return;

    if (socketRef.current?.connected) return;

    setConnectionState('connecting');
    const socketUrl = import.meta.env.VITE_WS_URL ?? '';

    socketRef.current = io(socketUrl, {
      auth: { token: currentToken },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000,
    });

    setupEventHandlers(socketRef.current, () => scheduleReconnectRef.current());
  }, [setupEventHandlers]);

  connectRef.current = connect;

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000) + Math.random() * 1000;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      const currentToken = useAuthStore.getState().accessToken;
      if (!currentToken) return;
      if (socketRef.current) {
        socketRef.current.auth = { token: currentToken };
        socketRef.current.connect();
      } else {
        connectRef.current();
      }
    }, delay);
  }, []);

  scheduleReconnectRef.current = scheduleReconnect;

  useEffect(() => {
    roomActions = {
      join: (groupId: string) => {
        joinedRooms.current.add(groupId);
        if (socketRef.current?.connected) {
          socketRef.current.emit('join-group', { groupId });
        }
      },
      leave: (groupId: string) => {
        joinedRooms.current.delete(groupId);
        if (socketRef.current?.connected) {
          socketRef.current.emit('leave-group', { groupId });
        }
      },
    };
    if (accessToken) {
      if (!socketRef.current) {
        connect();
      } else {
        socketRef.current.auth = { token: accessToken };
      }
      for (const groupId of pendingRooms) {
        roomActions.join(groupId);
      }
    } else {
      pendingRooms.clear();
      disconnect(true);
    }
    return () => {
      disconnect();
      roomActions = null;
    };
  }, [accessToken, connect, disconnect]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    joinGroupRoom: useCallback((groupId: string) => {
      joinedRooms.current.add(groupId);
      if (socketRef.current?.connected) {
        socketRef.current.emit('join-group', { groupId });
      }
    }, []),
    leaveGroupRoom: useCallback((groupId: string) => {
      joinedRooms.current.delete(groupId);
      if (socketRef.current?.connected) {
        socketRef.current.emit('leave-group', { groupId });
      }
    }, []),
    forceReconnect: () => {
      reconnectAttempts.current = 0;
      disconnect();
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, 500);
    },
  };
}
