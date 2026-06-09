import { query } from '../db/pool';
import { logger } from './logger';
import crypto from 'crypto';

interface CapturedError {
  errorCode: string;
  errorMessage: string;
  stackHash: string;
  module: string;
  sampleTrace: string | null;
  userId?: string;
  requestId?: string;
}

export async function captureError(
  error: Error | any,
  module: string,
  userId?: string,
  requestId?: string
): Promise<void> {
  try {
    const errorCode = error.code || error.name || 'ERR_UNKNOWN';
    const errorMessage = error.message || String(error);
    const stack = error.stack || '';
    const stackHash = crypto
      .createHash('sha512')
      .update(stack || errorMessage)
      .digest('hex')
      .slice(0, 16);

    const existing = await query<{
      id: number;
      occurrence_count: number;
    }>('SELECT id, occurrence_count FROM error_events WHERE stack_hash = $1', [
      stackHash,
    ]);

    if (existing.rows.length > 0) {
      await query(
        `UPDATE error_events SET last_seen = NOW(), occurrence_count = occurrence_count + 1 WHERE id = $1`,
        [existing.rows[0]!.id]
      );

      if (userId) {
        const affected = await query<{ cnt: number }>(
          `SELECT COUNT(DISTINCT user_id) as cnt FROM system_logs WHERE metadata->>'stackHash' = $1 AND user_id IS NOT NULL`,
          [stackHash]
        );
        if (affected.rows[0]) {
          await query(
            'UPDATE error_events SET affected_users = $1 WHERE id = $2',
            [affected.rows[0].cnt, existing.rows[0]!.id]
          );
        }
      }
    } else {
      await query(
        `INSERT INTO error_events (error_code, error_message, stack_hash, module, sample_trace, affected_users)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (stack_hash) DO UPDATE SET
           last_seen = NOW(),
           occurrence_count = error_events.occurrence_count + 1`,
        [
          errorCode,
          errorMessage.slice(0, 2000),
          stackHash,
          module,
          stack.split('\n').slice(0, 10).join('\n'),
          userId ? 1 : 0,
        ]
      );
    }

    logger.error(`[ErrorCapture] ${errorCode}: ${errorMessage}`, { module });
    try {
      logger.error(`${errorCode}: ${errorMessage}`, {
        module,
        requestId,
        userId,
        action: 'error_captured',
        errorCode,
        stackHash,
        stack: stack.split('\n').slice(0, 5),
      });
    } catch (logErr) {
    }
  } catch (captureErr) {
    logger.error('[ErrorCapture] Capture failed', { module: 'error-capture', error: String(captureErr) });
  }
}

export function registerGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection', { module: 'error-capture', reason: String(reason) });
    captureError(
      reason instanceof Error ? reason : new Error(String(reason)),
      'unhandled-rejection'
    );
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { module: 'error-capture', error: error.message });
    captureError(error, 'uncaught-exception').finally(() => {
      setTimeout(() => process.exit(1), 2000);
    });
  });
}
