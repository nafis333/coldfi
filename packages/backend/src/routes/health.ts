import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { getRedis } from '../services/redis';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'ok' | 'down';
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', error: (err as Error).message };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  try {
    const redis = getRedis();
    const start = Date.now();
    await redis.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', error: (err as Error).message };
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const allOk = database.status === 'ok' && redis.status === 'ok';
    const anyDown = database.status === 'down' || redis.status === 'down';

    const status = allOk ? 'ok' : anyDown ? 'down' : 'degraded';
    const statusCode = allOk ? 200 : anyDown ? 503 : 200;

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] || '1.0.0',
      services: {
        database,
        redis,
      },
    };

    return reply.status(statusCode).send(health);
  });

  app.get('/health/live', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async (request, reply) => {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const ready = database.status === 'ok' && redis.status === 'ok';

    return reply.status(ready ? 200 : 503).send({
      ready,
      services: { database, redis },
    });
  });
}
