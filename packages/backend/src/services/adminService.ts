import os from 'os';
import { query, transaction } from '../db/pool';
import { config } from '../config';
import { logger } from './logger';

export async function getAdminAuthMethods(): Promise<string[]> {
  const methods: string[] = ['jwt'];
  if (config.ADMIN_API_KEY) methods.push('api-key');
  return methods;
}

export async function getSystemInfo(): Promise<{
  version: string;
  nodeVersion: string;
  uptime: number;
  platform: string;
  memory: { total: number; free: number; heapTotal: number; heapUsed: number };
}> {
  return {
    version: '1.0.0',
    nodeVersion: process.version,
    uptime: process.uptime(),
    platform: process.platform,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
    },
  };
}

export async function getBannedUserCleanupCount(): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count FROM user_restrictions
     WHERE type = 'banned' AND lifted_at IS NULL
     AND created_at < NOW() - INTERVAL '30 days'`
  );
  return Number(result.rows[0]?.count || 0);
}

export async function cleanupBannedUsers(): Promise<number> {
  const eligible = await query(
    `SELECT user_id FROM user_restrictions
     WHERE type = 'banned' AND lifted_at IS NULL
     AND created_at < NOW() - INTERVAL '30 days'`
  );

  for (const row of eligible.rows) {
    try {
      await transaction(async (client) => {
        await client.query('UPDATE admin_audit_log SET actor_id = NULL WHERE actor_id = $1', [row.user_id]);
        await client.query('UPDATE error_events SET resolved_by = NULL WHERE resolved_by = $1', [row.user_id]);
        await client.query('UPDATE alert_history SET acknowledged_by = NULL WHERE acknowledged_by = $1', [row.user_id]);
        await client.query('UPDATE config_change_log SET changed_by = NULL WHERE changed_by = $1', [row.user_id]);
        await client.query('UPDATE slow_queries SET user_id = NULL WHERE user_id = $1', [row.user_id]);
        await client.query('UPDATE system_logs SET user_id = NULL WHERE user_id = $1', [row.user_id]);
        await client.query('UPDATE group_members SET left_at = NOW() WHERE user_id = $1 AND left_at IS NULL', [row.user_id]);
        await client.query('DELETE FROM notifications WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM push_subscriptions_web WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM notification_reminders WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [row.user_id]);
        await client.query('UPDATE group_sync SET updated_by = NULL WHERE updated_by = $1', [row.user_id]);
        await client.query('DELETE FROM user_restrictions WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM user_activity_log WHERE user_id = $1', [row.user_id]);
        await client.query('DELETE FROM users WHERE id = $1', [row.user_id]);
      });
    } catch (err) {
      logger.error('Failed to cleanup banned user', { module: 'admin', userId: row.user_id, error: String(err) });
    }
  }

  return eligible.rows.length;
}


