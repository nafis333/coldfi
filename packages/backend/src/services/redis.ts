import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redis: Redis | null = null;

export function setupRedis(): Redis {
  if (redis) return redis;

  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times > 10) {
        logger.error('Redis: max retry attempts reached', { module: 'redis' });
        return null;
      }
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
  });

  redis.on('connect', () => {
    logger.info('Redis connected', { module: 'redis' });
  });

  redis.on('error', (err) => {
    logger.error(`Redis error: ${err.message}`, { module: 'redis' });
  });

  redis.on('close', () => {
    logger.info('Redis connection closed', { module: 'redis' });
  });

  return redis;
}

export function getRedis(): Redis {
  if (!redis || redis.status === 'close' || redis.status === 'end') {
    throw new Error('Redis not available');
  }
  return redis;
}

export async function setTempToken(
  purpose: string,
  token: string,
  data: Record<string, any>,
  ttlSeconds: number = 900
): Promise<void> {
  const client = getRedis();
  const key = `temp:${purpose}:${token}`;
  await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

export async function getTempToken(
  purpose: string,
  token: string
): Promise<Record<string, any> | null> {
  const client = getRedis();
  const key = `temp:${purpose}:${token}`;

  const data = await client.getdel(key);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    logger.warn('Failed to parse temp token data', { module: 'redis', purpose, key });
    return null;
  }
}

export async function deleteTempToken(
  purpose: string,
  token: string
): Promise<void> {
  const client = getRedis();
  const key = `temp:${purpose}:${token}`;
  await client.del(key);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  const data = await client.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number = 3600
): Promise<void> {
  const client = getRedis();
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedis();
  await client.del(key);
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
