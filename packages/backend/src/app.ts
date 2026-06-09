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
import { requestMetrics } from './middleware/requestMetrics';
import { ipBlocker } from './middleware/ipBlocker';
import websocketPlugin from './plugins/websocket';
import { healthRoutes } from './routes/health';
import { healthEnhancedRoutes } from './routes/health-enhanced';
import { authRoutes } from './routes/auth';
import { personalRoutes, recoveryRoutes } from './routes/personal';
import { groupRoutes } from './routes/group';
import { notificationRoutes } from './routes/notifications';
import { adminRoutes } from './routes/admin';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
    ajv: { customOptions: { coerceTypes: 'array' } },
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(','),
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
  });

  app.addHook('onRequest', ipBlocker);
  app.addHook('onRequest', requestMetrics);

  app.setErrorHandler((error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId || 'unknown';
    const userId = request.user?.userId;

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
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'ERR_NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  await app.register(websocketPlugin);

  await app.register(healthRoutes);
  await app.register(healthEnhancedRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(personalRoutes, { prefix: '/personal' });
  await app.register(recoveryRoutes, { prefix: '/personal' });
  await app.register(groupRoutes, { prefix: '/group' });
  await app.register(notificationRoutes, { prefix: '/notifications' });
  await app.register(adminRoutes);

  return app;
}
