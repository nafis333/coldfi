import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { pingDatabase, pingRedis } from '../services/healthService';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: { status: 'ok' | 'down'; latencyMs?: number; error?: string };
    redis: { status: 'ok' | 'down'; latencyMs?: number; error?: string };
  };
}

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (config.NODE_ENV === 'production') return 'Service check failed';
  return msg;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    const [database, redis] = await Promise.all([
      (async () => {
        try {
          const result = await pingDatabase();
          return { status: 'ok' as const, latencyMs: result.latencyMs };
        } catch (err) {
          return { status: 'down' as const, error: sanitizeError(err) };
        }
      })(),
      (async () => {
        try {
          const result = await pingRedis();
          return { status: 'ok' as const, latencyMs: result.latencyMs };
        } catch (err) {
          return { status: 'down' as const, error: sanitizeError(err) };
        }
      })(),
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
      services: { database, redis },
    };

    return reply.status(statusCode).send(health);
  });

  app.get('/health/live', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async (request, reply) => {
    const [database, redis] = await Promise.all([
      (async () => {
        try {
          const result = await pingDatabase();
          return { status: 'ok' as const, latencyMs: result.latencyMs };
        } catch (err) {
          return { status: 'down' as const, error: sanitizeError(err) };
        }
      })(),
      (async () => {
        try {
          const result = await pingRedis();
          return { status: 'ok' as const, latencyMs: result.latencyMs };
        } catch (err) {
          return { status: 'down' as const, error: sanitizeError(err) };
        }
      })(),
    ]);

    const ready = database.status === 'ok' && redis.status === 'ok';

    return reply.status(ready ? 200 : 503).send({
      ready,
      services: { database, redis },
    });
  });
}
