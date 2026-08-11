import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../services/redis';
import { logger } from '../services/logger';

const GET_LIMIT = 200;
const GET_WINDOW_SECONDS = 60;
const WRITE_LIMIT = 50;
const WRITE_WINDOW_SECONDS = 60;

export async function adminRateLimit(request: FastifyRequest, reply: FastifyReply) {
  let redis;
  try {
    redis = getRedis();
  } catch {
    return;
  }

  const key = `rl:admin:${request.ip}`;
  const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const limit = isWrite ? WRITE_LIMIT : GET_LIMIT;
  const windowSeconds = isWrite ? WRITE_WINDOW_SECONDS : GET_WINDOW_SECONDS;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      const ttl = await redis.ttl(key);
      logger.warn(`Admin rate limit hit: ${key}`, {
        module: 'admin-rate-limiter',
        ip: request.ip,
        action: 'rate_limit_hit',
        key,
        limit,
      });
      reply.header('Retry-After', String(ttl));
      return reply.status(429).send({
        error: 'ERR_ADMIN_RATE_LIMIT',
        message: `Admin rate limit exceeded: ${limit} requests per minute`,
        retryAfter: ttl,
      });
    }
  } catch (err) {
    logger.error('Admin rate limiter error — allowing request', { module: 'admin-rate-limiter', error: String(err) });
  }
}

export function stopCleanupTimer() {
}