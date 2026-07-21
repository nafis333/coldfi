import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { query } from '../db/pool';
import { config } from '../config';

interface AuthenticatedSocket extends Socket {
  userId: string;
  role: string;
}

const userSockets = new Map<string, Set<string>>();
const socketGroups = new Map<string, Set<string>>();
const socketEventCounts = new Map<string, Map<string, { count: number; windowStart: number }>>();
const WS_RATE_LIMIT = 20;
const WS_RATE_WINDOW_MS = 10_000;
let io: SocketIOServer | null = null;

function checkWsRateLimit(socketId: string, event: string): boolean {
  let events = socketEventCounts.get(socketId);
  if (!events) {
    events = new Map();
    socketEventCounts.set(socketId, events);
  }
  const now = Date.now();
  let entry = events.get(event);
  if (!entry || now - entry.windowStart > WS_RATE_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    events.set(event, entry);
  }
  entry.count++;
  return entry.count <= WS_RATE_LIMIT;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialised. Register the websocket plugin first.');
  }
  return io;
}

export function emitToGroup(
  groupId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  if (!io) return;
  io.to(`group:${groupId}`).emit(event, payload);
}

export function emitToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  if (!io) return;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
}

export function getGroupConnectionCount(groupId: string): number {
  const server = getIO();
  const room = server.sockets.adapter.rooms.get(`group:${groupId}`);
  return room?.size ?? 0;
}

async function websocketPlugin(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const CORS_ORIGIN = config.CORS_ORIGIN;
  if (!CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN must be set for WebSocket CORS');
  }

  io = new SocketIOServer(app.server, {
    cors: {
      origin: CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = await app.jwt.verify(token) as any;
      if (!decoded.userId) {
        return next(new Error('Invalid token payload'));
      }
      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).role = decoded.role || 'user';
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    app.log.info({ userId, socketId: socket.id }, 'WebSocket client connected');

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socketGroups.set(socket.id, new Set());

    socket.on('join-group', async (data: { groupId: string }) => {
      if (!checkWsRateLimit(socket.id, 'join-group')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      try {
        const { groupId } = data;
        if (!groupId || typeof groupId !== 'string') {
          socket.emit('error', { message: 'groupId is required' });
          return;
        }

        const memberResult = await query(
          `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [groupId, userId]
        );
        if (memberResult.rows.length === 0) {
          socket.emit('error', { message: 'You are not a member of this group' });
          return;
        }

        const room = `group:${groupId}`;
        socket.join(room);
        socketGroups.get(socket.id)?.add(groupId);

        app.log.info({ userId, groupId }, 'User joined group room');

        socket.emit('joined-group', { groupId, success: true });
        socket.to(room).emit('member-online', {
          groupId,
          userId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        app.log.error({ userId, groupId: data?.groupId, err }, 'Failed to join group room');
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    socket.on('leave-group', (data: { groupId: string }) => {
      if (!checkWsRateLimit(socket.id, 'leave-group')) {
        socket.emit('error', { message: 'Too many requests. Please slow down.' });
        return;
      }
      const { groupId } = data;
      if (!groupId || typeof groupId !== 'string') {
        socket.emit('error', { message: 'groupId is required' });
        return;
      }

      const room = `group:${groupId}`;
      socket.leave(room);
      socketGroups.get(socket.id)?.delete(groupId);

      app.log.info({ userId, groupId }, 'User left group room');

      socket.emit('left-group', { groupId, success: true });
      socket.to(room).emit('member-offline', {
        groupId,
        userId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', (reason: string) => {
      app.log.info({ userId, socketId: socket.id, reason }, 'WebSocket client disconnected');

      const groups = socketGroups.get(socket.id);
      if (groups) {
        for (const groupId of groups) {
          socket.to(`group:${groupId}`).emit('member-offline', {
            groupId,
            userId,
            timestamp: new Date().toISOString(),
          });
        }
      }

      socketGroups.delete(socket.id);
      socketEventCounts.delete(socket.id);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  app.addHook('onClose', async () => {
    if (io) {
      io.close();
      io = null;
      userSockets.clear();
      socketGroups.clear();
      socketEventCounts.clear();
    }
  });

  app.log.info('WebSocket plugin registered');
}

export default fp(websocketPlugin, {
  name: 'websocket',
});
