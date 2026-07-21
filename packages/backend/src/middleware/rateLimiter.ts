import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../services/redis';
import { logger } from '../services/logger';

interface RateLimitOptions {
  windowSeconds: number;
  maxAttempts: number;
  keyPrefix: string;
  keyFn: (req: FastifyRequest) => string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowSeconds, maxAttempts, keyPrefix, keyFn } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    let redis;
    try {
      redis = getRedis();
    } catch {
      return;
    }
    const key = `${keyPrefix}:${keyFn(request)}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      } else if (current > maxAttempts) {
        // Refresh TTL on existing key so the ban window resets with each new attempt
        await redis.expire(key, windowSeconds);
      }

      if (current > maxAttempts) {
        const ttl = await redis.ttl(key);
        reply.status(429).header('Retry-After', String(ttl)).send({
          error: 'ERR_RATE_LIMIT',
          message: `Too many attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
          retryAfter: ttl,
        });
        return;
      }

      reply.header('X-RateLimit-Limit', String(maxAttempts));
      reply.header('X-RateLimit-Remaining', String(Math.max(0, maxAttempts - current)));
      reply.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + windowSeconds));
    } catch (err) {
      logger.error('Rate limiter error — allowing request', { module: 'rate-limiter', error: String(err) });
    }
  };
}

export const loginRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 20,
  keyPrefix: 'rl:login',
  keyFn: (req) => {
    const email = (req.body as any)?.email || 'unknown';
    return `${req.ip || 'unknown'}:${email}`;
  },
});

export const registerRateLimiter = createRateLimiter({
  windowSeconds: 3600,
  maxAttempts: 20,
  keyPrefix: 'rl:register',
  keyFn: (req) => req.ip || 'unknown',
});

export const passwordChangeRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 3,
  keyPrefix: 'rl:pwd',
  keyFn: (req: any) => req.user?.userId || req.ip || 'unknown',
});

export const twoFARateLimiter = createRateLimiter({
  windowSeconds: 600,
  maxAttempts: 5,
  keyPrefix: 'rl:2fa',
  keyFn: (req) => req.ip || 'unknown',
});

export const refreshRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 30,
  keyPrefix: 'rl:refresh',
  keyFn: (req) => req.ip || 'unknown',
});

export const recoverRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 5,
  keyPrefix: 'rl:recover',
  keyFn: (req) => (req.body as any)?.email || req.ip || 'unknown',
});

export const recoverCompleteRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 5,
  keyPrefix: 'rl:recover-complete',
  keyFn: (req) => req.ip || 'unknown',
});

export const backfillPekRateLimiter = createRateLimiter({
  windowSeconds: 3600,
  maxAttempts: 10,
  keyPrefix: 'rl:backfill-pek',
  keyFn: (req: any) => req.user?.userId || req.ip || 'unknown',
});

export const twoFASetupRateLimiter = createRateLimiter({
  windowSeconds: 900,
  maxAttempts: 5,
  keyPrefix: 'rl:2fa-setup',
  keyFn: (req: any) => req.user?.userId || req.ip || 'unknown',
});

export const profileRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxAttempts: 10,
  keyPrefix: 'rl:profile',
  keyFn: (req: any) => req.user?.userId || req.ip || 'unknown',
});
