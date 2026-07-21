import { query } from '../db/pool';
import { config } from '../config';

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
  memory: { total: number; free: number };
}> {
  return {
    version: '1.0.0',
    nodeVersion: process.version,
    uptime: process.uptime(),
    platform: process.platform,
    memory: {
      total: process.memoryUsage().heapTotal,
      free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
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
    await query('DELETE FROM user_restrictions WHERE user_id = $1', [row.user_id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.user_id]);
    await query('DELETE FROM user_activity_log WHERE user_id = $1', [row.user_id]);
    await query('UPDATE group_members SET left_at = NOW() WHERE user_id = $1 AND left_at IS NULL', [row.user_id]);
    await query('UPDATE slow_queries SET user_id = NULL WHERE user_id = $1', [row.user_id]);
    await query('UPDATE system_logs SET user_id = NULL WHERE user_id = $1', [row.user_id]);
    await query('DELETE FROM users WHERE id = $1', [row.user_id]);
  }

  return eligible.rows.length;
}


