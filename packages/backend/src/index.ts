import { buildApp } from './app';
import { config } from './config';
import { setupRedis, getRedis } from './services/redis';
import { setupJobProcessor } from './jobs';
import { registerGlobalErrorHandlers } from './services/errorCapture';
import { logger } from './services/logger';
import { query, closePool, pool } from './db/pool';

async function main() {
  logger.init();
  logger.info('Starting server...', { module: 'startup', env: config.NODE_ENV });

  registerGlobalErrorHandlers();

  try {
    const redis = setupRedis();
    await redis.connect();
    logger.info('Redis connected', { module: 'startup' });
  } catch (err) {
    logger.error('Failed to connect to Redis — continuing without Redis', { module: 'startup', error: String(err) });
  }

  try {
    const result = await query('SELECT NOW() as now');
    logger.info('Database connected', { module: 'startup', timestamp: result.rows[0]?.now });
  } catch (err) {
    await logger.fatal('Failed to connect to database', { module: 'startup', error: String(err) });
    process.exit(1);
  }

  try {
    const { runMigrations } = await import('./db/migrate');
    await runMigrations();
  } catch (err) {
    await logger.fatal('Migration failed', { module: 'startup', error: String(err) });
    process.exit(1);
  }

  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`Server running on ${config.HOST}:${config.PORT}`, { module: 'startup' });
  } catch (err) {
    await logger.fatal('Failed to start server', { module: 'startup', error: String(err) });
    process.exit(1);
  }

  try {
    await setupJobProcessor(pool);
    logger.info('Job processor started', { module: 'startup' });
  } catch (err) {
    logger.error('Failed to start job processor', { module: 'startup', error: String(err) });
  }

  // Admin routes are registered in app.ts — no separate admin server needed

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down...`, { module: 'shutdown' });

    try {
      await app.close();
      logger.info('HTTP server closed', { module: 'shutdown' });

      try {
        const redis = getRedis();
        await redis.quit();
        logger.info('Redis connection closed', { module: 'shutdown' });
      } catch (_) {}

      await closePool();
      logger.info('Database pool closed', { module: 'shutdown' });

      logger.info('Graceful shutdown complete', { module: 'shutdown' });
      logger.destroy();
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(async (err) => {
  await logger.fatal('Failed to start server', { module: 'startup', error: String(err) });
  process.exit(1);
});
