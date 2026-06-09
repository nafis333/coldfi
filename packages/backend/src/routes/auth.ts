import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import {
  registerUser,
  loginUser,
  generateTokens,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  changePassword,
  generate2FASecret,
  verify2FASetup,
  verify2FALogin,
  disable2FA,
} from '../services/authService';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordChangeRateLimiter,
  twoFARateLimiter,
  refreshRateLimiter,
} from '../middleware/rateLimiter';

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function authRoutes(app: FastifyInstance) {
    app.post('/register', {
    preHandler: [registerRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'authKeyHash'],
        properties: {
          email: { type: 'string', format: 'email' },
          authKeyHash: { type: 'string', minLength: 32 },
          displayName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, authKeyHash, displayName } = request.body as any;
    const result = await registerUser({ email, authKeyHash, displayName });
    const tokens = await generateTokens(result.userId);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.status(201).send({
      userId: result.userId,
      personalSalt: result.personalSalt,
      role: tokens.role,
      accessToken: tokens.accessToken,
      displayName: tokens.displayName,
    });
  });

    app.post('/login', {
    preHandler: [loginRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'authKeyHash'],
        properties: {
          email: { type: 'string', format: 'email' },
          authKeyHash: { type: 'string', minLength: 32 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, authKeyHash } = request.body as any;
    const result = await loginUser({ email, authKeyHash });

    if (result.requires2FA) {
      return reply.send({
        requires2FA: true,
        tempToken: result.tempToken,
        userId: result.userId,
        personalSalt: result.personalSalt,
      });
    }

    const tokens = await generateTokens(result.userId);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.send({
      userId: result.userId,
      personalSalt: result.personalSalt,
      role: tokens.role,
      accessToken: tokens.accessToken,
      displayName: tokens.displayName,
    });
  });

  app.post('/2fa/verify', {
    preHandler: [twoFARateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['tempToken', 'code'],
        properties: {
          tempToken: { type: 'string' },
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { tempToken, code } = request.body as any;
    const tokens = await verify2FALogin(tempToken, code);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.send({
      accessToken: tokens.accessToken,
      role: tokens.role || 'user',
      userId: tokens.userId,
      displayName: tokens.displayName,
      personalSalt: tokens.personalSalt,
    });
  });

  app.post('/refresh', { preHandler: [refreshRateLimiter] }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'ERR_NO_REFRESH_TOKEN', message: 'No refresh token provided' });
    }

    const tokens = await refreshAccessToken(refreshToken);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.send({
      accessToken: tokens.accessToken,
      role: tokens.role,
      userId: tokens.userId,
      displayName: tokens.displayName,
      personalSalt: tokens.personalSalt,
    });
  });

  app.post('/logout', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        204: { type: 'null' },
      },
    },
  }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (refreshToken) await logoutUser(request.user!.userId, refreshToken);
    reply.clearCookie('refreshToken', { path: '/auth' });
    return reply.status(204);
  });

  app.post('/logout-all', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const result = await logoutAllDevices(request.user!.userId);
    return reply.send(result);
  });

  app.post('/change-password', {
    preHandler: [app.authenticate, passwordChangeRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['oldAuthKeyHash', 'newAuthKeyHash'],
        properties: {
          oldAuthKeyHash: { type: 'string', minLength: 32 },
          newAuthKeyHash: { type: 'string', minLength: 32 },
        },
      },
    },
  }, async (request, reply) => {
    const { oldAuthKeyHash, newAuthKeyHash } = request.body as any;
    if (oldAuthKeyHash === newAuthKeyHash) {
      return reply.status(400).send({ error: 'ERR_VALIDATION', message: 'New password must differ from current password' });
    }
    const result = await changePassword({ userId: request.user!.userId, oldAuthKeyHash, newAuthKeyHash });
    return reply.send(result);
  });

  app.post('/2fa/setup', { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await generate2FASecret(request.user!.userId);
    return reply.send(result);
  });

  app.post('/2fa/enable', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { code } = request.body as any;
    await verify2FASetup(request.user!.userId, code);
    return reply.send({ message: '2FA enabled' });
  });

  app.post('/2fa/disable', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { code } = request.body as any;
    await disable2FA(request.user!.userId, code);
    return reply.send({ message: '2FA disabled' });
  });
}
