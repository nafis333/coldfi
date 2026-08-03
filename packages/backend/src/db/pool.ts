import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config, VERSION } from '../config';
import { logger } from '../services/logger';

export { VERSION };

// pg.Pool keeps internal stats via totalCount, idleCount, waitingCount
export interface PoolStats {
  total: number;
  idle: number;
  active: number;
  waiting: number;
  maxSize: number;
}

export function getPoolStats(): PoolStats {
  const p = pool as unknown as {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    options: { max: number };
  };
  const total = p.totalCount || 0;
  const idle = p.idleCount || 0;
  return {
    total,
    idle,
    active: total - idle,
    waiting: p.waitingCount || 0,
    maxSize: p.options?.max || 20,
  };
}

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected pool error', { module: 'db', error: err.message });
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (config.SLOW_QUERY_THRESHOLD_MS && duration > config.SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(`Slow query (${duration}ms)`, { module: 'db', query: text.slice(0, 100) });
  }

  return result;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let began = false;

  try {
    await client.query('BEGIN');
    began = true;
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (began) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
