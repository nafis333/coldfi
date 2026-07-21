import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';
import { query } from '../db/pool';
import { logger } from '../services/logger';

let adminIo: SocketIOServer | null = null;
let connectedAdmins = 0;
const MAX_ADMIN_WS = 50;

export function getAdminIO(): SocketIOServer {
  if (!adminIo) throw new Error('Admin WebSocket not initialised');
  return adminIo;
}

export async function setupAdminWebSocket(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    path: '/ws/admin',
    cors: {
      origin: config.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = app.jwt.verify(token) as any;
      if (decoded.role !== 'owner') return next(new Error('Admin access required'));
      (socket as any).adminId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    if (connectedAdmins >= MAX_ADMIN_WS) {
      socket.disconnect(true);
      return;
    }
    connectedAdmins++;

    socket.on('subscribe-logs', (filters?: { level?: string; module?: string }) => {
      socket.join('admin:logs');
      (socket as any).logFilters = filters || {};
    });

    socket.on('subscribe-stats', () => {
      socket.join('admin:stats');
    });

    socket.on('subscribe-alerts', () => {
      socket.join('admin:alerts');
    });

    socket.on('disconnect', () => {
      connectedAdmins--;
    });
  });

  adminIo = io;

  app.decorate('adminWs', io);
  app.decorate('broadcastLog', (entry: any) => {
    io.to('admin:logs').emit('new-log', entry);
  });
  app.decorate('broadcastStats', (stats: any) => {
    io.to('admin:stats').emit('stats-update', stats);
  });
  app.decorate('broadcastAlert', (alert: any) => {
    io.to('admin:alerts').emit('new-alert', alert);
  });

  const statsInterval = setInterval(async () => {
    try {
      const { getAggregateStats } = await import('../services/monitoringService');
      const stats = await getAggregateStats();
      io.to('admin:stats').emit('stats-update', stats);
    } catch (err) { logger.error('Admin stats broadcast failed', { error: String(err) }); }
  }, 30000);

  app.addHook('onClose', async () => {
    clearInterval(statsInterval);
    io.close();
  });

  return io;
}
