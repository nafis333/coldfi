import Fastify, { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { config } from './config';
import { AppError, AuthError, ValidationError } from './errors';
import { captureError } from './services/errorCapture';
import { assertUserNotRestricted } from './services/userRestrictions';
import { requestMetrics } from './middleware/requestMetrics';
import { ipBlocker } from './middleware/ipBlocker';
import websocketPlugin from './plugins/websocket';
import { setupAdminWebSocket } from './plugins/admin-websocket';
import { healthRoutes } from './routes/health';
import { healthEnhancedRoutes } from './routes/health-enhanced';
import { authRoutes } from './routes/auth';
import { personalRoutes } from './routes/personal';
import { groupRoutes } from './routes/group';
import { notificationRoutes } from './routes/notifications';
import { adminRoutes } from './routes/admin';
import { syncRoutes } from './routes/sync';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
    ajv: { customOptions: { coerceTypes: 'array' } },
    bodyLimit: 1048576,
    trustProxy: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  const origins = [
    ...config.CORS_ORIGIN.split(','),
    'https://coldfi.vercel.app',
  ].map(o => o.trim()).filter(Boolean);

  await app.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const cookieSecret = config.COOKIE_SECRET;

  await app.register(cookie, {
    secret: cookieSecret,
    hook: 'onRequest',
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_RECEIPT_SIZE_MB * 1024 * 1024,
      files: 5,
    },
    throwFileSizeLimit: false,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRY },
    cookie: {
      cookieName: 'refreshToken',
      signed: true,
    },
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new AuthError('ERR_UNAUTHORIZED', 'Invalid or expired token');
    }
    await assertUserNotRestricted(request.user.userId);
  });

  app.addHook('onRequest', ipBlocker);
  app.addHook('onRequest', requestMetrics);

  app.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId || 'unknown';
    const userId = request.user?.userId;
    const origin = request.headers.origin;
    const allOrigins = [...config.CORS_ORIGIN.split(',').map(o => o.trim()), 'https://coldfi.vercel.app'];
    if (origin && allOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (error instanceof AppError) {
      if (!error.isOperational) {
        captureError(error, request.routeOptions?.url || request.url, userId, requestId);
      }
      return reply.status(error.statusCode).send(error.toJSON());
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'Request validation failed',
        ...(config.NODE_ENV !== 'production' && {
          details: error.validation.map(v => ({
            field: v.instancePath,
            message: v.message,
          })),
        }),
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'ERR_RATE_LIMIT',
        message: 'Too many requests. Please slow down.',
      });
    }

    captureError(error, request.routeOptions?.url || request.url, userId, requestId);

    return reply.status(error.statusCode ?? 500).send({
      error: 'ERR_INTERNAL',
      message: config.NODE_ENV === 'production' ? 'An internal error occurred' : error.message,
    });
  });

  app.get('/', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'ERR_NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  await app.register(websocketPlugin);

  try {
    await setupAdminWebSocket(app);
  } catch (err) {
    app.log.warn({ err }, 'Admin WebSocket setup skipped');
  }

  await app.register(healthRoutes);
  await app.register(healthEnhancedRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(personalRoutes, { prefix: '/api/personal' });
  await app.register(groupRoutes, { prefix: '/api/group' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(syncRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });

  return app;
}
