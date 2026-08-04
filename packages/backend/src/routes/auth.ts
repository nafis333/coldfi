import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { config, parseExpirySeconds } from '../config';
import {
  registerUser,
  loginUser,
  googleLogin,
  updateProfile,
} from '../services/authService';
import { encryptServerKey } from '../services/cryptoUtils';
import {
  generateTokens,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
} from '../services/tokenService';
import {
  changePassword,
  recoverAccount,
} from '../services/passwordService';
import {
  generate2FASecret,
  verify2FASetup,
  verify2FALogin,
  disable2FA,
  getTwoFactorStatus,
} from '../services/twoFactorService';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordChangeRateLimiter,
  twoFARateLimiter,
  refreshRateLimiter,
  recoverRateLimiter,
  recoverCompleteRateLimiter,
  backfillPekRateLimiter,
  twoFASetupRateLimiter,
  profileRateLimiter,
} from '../middleware/rateLimiter';
import { query, transaction } from '../db/pool';
import { ForbiddenError } from '../errors';
import { setTempToken, getTempToken, deleteTempToken } from '../services/redis';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const REFRESH_MAX_AGE = parseExpirySeconds(config.JWT_REFRESH_EXPIRY, 30 * 86400);

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function authRoutes(app: FastifyInstance) {
    app.post('/register', {
    preHandler: [registerRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'authKeyHash', 'personalSalt', 'encryptedPek', 'rawPek'],
        properties: {
          email: { type: 'string', format: 'email' },
          authKeyHash: { type: 'string', minLength: 32, maxLength: 128 },
          personalSalt: { type: 'string', minLength: 1 },
          encryptedPek: { type: 'string', minLength: 1 },
          rawPek: { type: 'string', minLength: 1 },
          displayName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, authKeyHash, displayName, personalSalt, encryptedPek, rawPek } = request.body as any;
    const result = await registerUser({ email, authKeyHash, displayName, personalSalt, encryptedPek, rawPek });
    const tokens = await generateTokens(result.userId);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.status(201).send({
      userId: result.userId,
      personalSalt: result.personalSalt,
      encryptedPek: result.encryptedPek,
      role: tokens.role,
      accessToken: tokens.accessToken,
      displayName: tokens.displayName,
      recoveryCode: result.recoveryCode,
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
          authKeyHash: { type: 'string', minLength: 32, maxLength: 128 },
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
        encryptedPek: result.encryptedPek,
      });
    }

    const tokens = await generateTokens(result.userId);

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.send({
      accessToken: tokens.accessToken,
      role: tokens.role,
      userId: tokens.userId,
      displayName: tokens.displayName,
      personalSalt: tokens.personalSalt,
      encryptedPek: tokens.encryptedPek,
      email: tokens.email,
      isGoogleUser: tokens.isGoogleUser,
    });
  });

  app.post('/backfill-pek', {
    preHandler: [app.authenticate, backfillPekRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['rawPek'],
        properties: {
          rawPek: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { rawPek } = request.body as { rawPek: string };
    const userId = request.user!.userId;
    const serverEncryptedPek = encryptServerKey(rawPek);
    await query(`UPDATE users SET server_encrypted_pek = $1 WHERE id = $2`, [serverEncryptedPek, userId]);
    return reply.send({ success: true });
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
      encryptedPek: tokens.encryptedPek,
      email: tokens.email,
      isGoogleUser: tokens.isGoogleUser,
    });
  });

  app.post('/google', {
    preHandler: [loginRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['idToken'],
        properties: {
          idToken: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { idToken } = request.body as { idToken: string };
    try {
      const result = await googleLogin(idToken);

      setRefreshCookie(reply, result.refreshToken);

      return reply.send({
        accessToken: result.accessToken,
        role: result.role,
        userId: result.userId,
        displayName: result.displayName,
        personalSalt: result.personalSalt,
        encryptedPek: result.encryptedPek,
        email: result.email,
        isGoogleUser: true,
        googleNewUser: result.googleNewUser,
        recoveryCode: result.googleNewUser ? result.recoveryCode : undefined,
      });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.code || 'ERR_GOOGLE_LOGIN_FAILED', message: err.isOperational ? err.message : 'Google login failed' });
      }
      request.log.error({ err }, 'POST /auth/google failed');
      return reply.status(500).send({ error: 'ERR_INTERNAL', message: 'Google login failed' });
    }
  });

  app.post('/refresh', { preHandler: [refreshRateLimiter] }, async (request, reply) => {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const allowedOrigins = [...config.CORS_ORIGIN.split(',').map(o => o.trim()), 'https://coldfi.vercel.app'];
    if (origin && !allowedOrigins.some(o => o === origin)) {
      throw new ForbiddenError('Request origin not allowed');
    }
    if (!origin && referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (!allowedOrigins.some(o => o === refOrigin)) {
          throw new ForbiddenError('Request origin not allowed');
        }
      } catch {
        throw new ForbiddenError('Request origin not allowed');
      }
    }
    if (!origin && !referer) {
      throw new ForbiddenError('Request origin not allowed');
    }

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
      encryptedPek: tokens.encryptedPek,
      email: tokens.email,
      isGoogleUser: tokens.isGoogleUser,
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
    reply.clearCookie('refreshToken', { path: '/api/auth', secure: config.NODE_ENV === 'production', sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax' });
    return reply.status(204).send(null);
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
        required: ['oldAuthKeyHash', 'newAuthKeyHash', 'personalSalt', 'encryptedPek'],
        properties: {
          oldAuthKeyHash: { type: 'string', minLength: 32, maxLength: 128 },
          newAuthKeyHash: { type: 'string', minLength: 32, maxLength: 128 },
          personalSalt: { type: 'string', minLength: 1 },
          encryptedPek: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { oldAuthKeyHash, newAuthKeyHash, personalSalt, encryptedPek } = request.body as any;
    const result = await changePassword({ userId: request.user!.userId, oldAuthKeyHash, newAuthKeyHash, personalSalt, encryptedPek });
    return reply.send(result);
  });

  app.post('/recover', {
    preHandler: [recoverRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'recoveryCode'],
        properties: {
          email: { type: 'string', format: 'email' },
          recoveryCode: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, recoveryCode } = request.body as { email: string; recoveryCode: string };
      const result = await recoverAccount({ email, recoveryCode });

      const resetToken = crypto.randomBytes(32).toString('hex');
      await setTempToken('recover', resetToken, {
        userId: result.userId,
        email: result.email,
        rawPek: result.rawPek,
      }, 300);

      return reply.send({ tempToken: resetToken, rawPek: result.rawPek });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: 'ERR_RECOVERY_FAILED', message: 'Invalid email or recovery code' });
      }
      request.log.error({ err }, 'POST /recover failed');
      return reply.status(500).send({ error: 'ERR_INTERNAL', message: 'Failed to recover account.' });
    }
  });

  app.post('/recover/complete', {
    schema: {
      body: {
        type: 'object',
        required: ['tempToken', 'authKeyHash', 'personalSalt', 'encryptedPek'],
        properties: {
          tempToken: { type: 'string', minLength: 1 },
          authKeyHash: { type: 'string', minLength: 32, maxLength: 128 },
          personalSalt: { type: 'string', minLength: 1 },
          encryptedPek: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [recoverCompleteRateLimiter],
  }, async (request, reply) => {
    try {
      const { tempToken, authKeyHash, personalSalt, encryptedPek } = request.body as {
        tempToken: string;
        authKeyHash: string;
        personalSalt: string;
        encryptedPek: string;
      };

      const data = await getTempToken('recover', tempToken);
      if (!data) {
        return reply.status(400).send({ error: 'ERR_TOKEN_INVALID', message: 'Invalid or expired recovery session.' });
      }

      const hashedAuthKey = await bcrypt.hash(authKeyHash, SALT_ROUNDS);
      const serverEncryptedPek = encryptServerKey(data.rawPek);

      await transaction(async (client) => {
        await client.query(
          `UPDATE users SET auth_key_hash = $1, personal_salt = $2, encrypted_pek = $3, server_encrypted_pek = $4, updated_at = NOW() WHERE id = $5`,
          [hashedAuthKey, personalSalt, encryptedPek, serverEncryptedPek, data.userId]
        );

        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`,
          [data.userId]
        );
      });

      await deleteTempToken('recover', tempToken);
      return reply.send({ success: true });
    } catch (err: any) {
      request.log.error({ err }, 'POST /recover/complete failed');
      return reply.status(500).send({ error: 'ERR_INTERNAL', message: 'Failed to complete account recovery.' });
    }
  });

  app.get('/2fa/status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await getTwoFactorStatus(request.user!.userId);
    return reply.send(result);
  });

  app.post('/2fa/setup', { preHandler: [app.authenticate, twoFASetupRateLimiter] }, async (request, reply) => {
    const result = await generate2FASecret(request.user!.userId);
    return reply.send(result);
  });

  app.post('/2fa/enable', {
    preHandler: [app.authenticate, twoFARateLimiter],
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
    preHandler: [app.authenticate, twoFARateLimiter],
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

  app.put('/profile', {
    preHandler: [app.authenticate, profileRateLimiter],
    schema: {
      body: {
        type: 'object',
        properties: {
          displayName: { type: 'string', maxLength: 100 },
          defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 },
          timezone: { type: 'string', maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { displayName, defaultCurrency, timezone } = request.body as any;
    const result = await updateProfile(request.user!.userId, { displayName, defaultCurrency, timezone });
    return reply.send(result);
  });
}
