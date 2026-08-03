import { Worker, Queue, Job } from 'bullmq';
import { Pool } from 'pg';
import IORedis from 'ioredis';
import { ReminderService } from '../services/reminderService';
import { WebPushService } from '../services/webPush';
import { logger } from '../services/logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REMINDER_QUEUE_NAME = 'reminders';
const POLL_INTERVAL_MS = parseInt(process.env.REMINDER_POLL_INTERVAL ?? '60000', 10) || 60000;
const BATCH_SIZE = parseInt(process.env.REMINDER_BATCH_SIZE ?? '50', 10) || 50;

function createRedisConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times > 10) {
        logger.error('ReminderWorker: max retry attempts reached', { module: 'reminder-worker' });
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });
}

export function createReminderQueue(): Queue {
  return new Queue(REMINDER_QUEUE_NAME, {
    connection: createRedisConnection() as any,
  });
}

export async function scheduleReminderCheck(queue: Queue): Promise<Job> {
  return queue.add(
    'check-pending-reminders',
    {},
    {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

export async function scheduleRecurringReminderCheck(queue: Queue): Promise<void> {
  await queue.add(
    'check-pending-reminders',
    {},
    {
      repeat: {
        every: POLL_INTERVAL_MS,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

export function createReminderWorker(pool: Pool): Worker {
  const pushService = new WebPushService(pool);
  const reminderService = new ReminderService(pool, pushService);

  const worker = new Worker(
    REMINDER_QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== 'check-pending-reminders') {
        logger.warn(`Unknown job name: ${job.name}`, { module: 'reminder-worker' });
        return { processed: 0 };
      }

      logger.info('Checking for pending reminders...', { module: 'reminder-worker' });

      const pendingReminders = await reminderService.getPendingReminders(BATCH_SIZE);

      if (pendingReminders.length === 0) {
        logger.debug('No pending reminders found.', { module: 'reminder-worker' });
        return { processed: 0 };
      }

      logger.info(`Found ${pendingReminders.length} pending reminders.`, { module: 'reminder-worker' });

      let successCount = 0;
      let failCount = 0;

      for (const reminder of pendingReminders) {
        try {
          const sent = await reminderService.processReminder(reminder);
          if (sent) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          logger.error('Reminder processing failed', { module: 'reminder-worker', reminderId: reminder.id, error: String(err) });
          failCount++;
        }
      }

      logger.info(
        `Processed ${pendingReminders.length} reminders: ${successCount} sent, ${failCount} failed.`,
        { module: 'reminder-worker' }
      );

      return {
        processed: pendingReminders.length,
        sent: successCount,
        failed: failCount,
      };
    },
    {
      connection: createRedisConnection() as any,
      concurrency: 1,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed: ${JSON.stringify(job.returnvalue)}`, { module: 'reminder-worker' });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed: ${error.message}`, { module: 'reminder-worker' });
  });

  worker.on('error', (error) => {
    logger.error(`Worker error: ${error.message}`, { module: 'reminder-worker' });
  });

  logger.info('Reminder worker started.', { module: 'reminder-worker' });

  return worker;
}

export async function startReminderSystem(pool: Pool): Promise<{
  worker: Worker;
  queue: Queue;
}> {
  const queue = createReminderQueue();
  const worker = createReminderWorker(pool);

  await scheduleRecurringReminderCheck(queue);
  logger.info('Recurring reminder check scheduled.', { module: 'reminder-worker' });

  await scheduleReminderCheck(queue);
  logger.info('Initial reminder check queued.', { module: 'reminder-worker' });

  return { worker, queue };
}

export async function stopReminderSystem(
  worker: Worker,
  queue: Queue
): Promise<void> {
  logger.info('Reminder system shutting down...', { module: 'reminder-worker' });
  await worker.close();
  await queue.close();
  logger.info('Reminder system shutdown complete.', { module: 'reminder-worker' });
}
