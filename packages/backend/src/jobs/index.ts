import { Pool } from 'pg';
import { startReminderSystem } from './reminderWorker';
import { logger } from '../services/logger';

export async function setupJobProcessor(pool: Pool): Promise<void> {
  try {
    const { worker, queue } = await startReminderSystem(pool);
    logger.info('Job processor started — reminder system active', { module: 'jobs' });

    process.on('SIGTERM', async () => {
      const { stopReminderSystem } = await import('./reminderWorker');
      await stopReminderSystem(worker, queue);
    });
  } catch (err) {
    logger.error('Failed to start job processor', { module: 'jobs', error: String(err) });
    throw err;
  }
}
