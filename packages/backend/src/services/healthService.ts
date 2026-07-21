import { pool } from '../db/pool';
import { getRedis } from '../services/redis';

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  await pool.query('SELECT 1');
  return { ok: true, latencyMs: Date.now() - start };
}

export async function pingRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const redis = getRedis();
  const start = Date.now();
  await redis.ping();
  return { ok: true, latencyMs: Date.now() - start };
}
