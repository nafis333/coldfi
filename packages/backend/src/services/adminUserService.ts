import { query, transaction } from '../db/pool';
import { invalidateRestrictionCache } from './userRestrictions';

export interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number };
}

export async function forceLogoutUser(userId: string): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

export async function suspendUser(
  userId: string,
  reason: string,
  durationHours: number | null,
  adminId: string
): Promise<Date | null> {
  const expiresAt = durationHours != null ? new Date(Date.now() + durationHours * 3600000) : null;

  await transaction(async (client) => {
    await client.query(
      `UPDATE user_restrictions SET lifted_at = NOW()
       WHERE user_id = $1 AND type = 'suspended' AND lifted_at IS NULL`,
      [userId]
    );

    await client.query(
      `INSERT INTO user_restrictions (user_id, type, reason, admin_id, expires_at, created_at)
       VALUES ($1, 'suspended', $2, $3, $4, NOW())`,
      [userId, reason, adminId, expiresAt]
    );
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  });

  invalidateRestrictionCache(userId);
  return expiresAt;
}

export async function banUser(
  userId: string,
  reason: string,
  adminId: string
): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `UPDATE user_restrictions SET lifted_at = NOW()
       WHERE user_id = $1 AND type = 'banned' AND lifted_at IS NULL`,
      [userId]
    );

    await client.query(
      `INSERT INTO user_restrictions (user_id, type, reason, admin_id, created_at)
       VALUES ($1, 'banned', $2, $3, NOW())`,
      [userId, reason, adminId]
    );
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  });

  invalidateRestrictionCache(userId);
}

export async function restoreUser(userId: string): Promise<void> {
  await query(
    `UPDATE user_restrictions SET lifted_at = NOW()
     WHERE user_id = $1 AND lifted_at IS NULL`,
    [userId]
  );
  invalidateRestrictionCache(userId);
}

export async function deleteUser(userId: string, adminId: string): Promise<void> {
  await transaction(async (client) => {
    const targetUser = await client.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (targetUser.rows.length === 0) throw new Error('ERR_USER_NOT_FOUND');
    if (targetUser.rows[0].role === 'owner') {
      const ownerCount = await client.query(`SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'owner' FOR UPDATE`);
      if (ownerCount.rows[0]?.cnt <= 1) {
        throw new Error('ERR_LAST_OWNER');
      }
    }

    await client.query('UPDATE slow_queries SET user_id = NULL WHERE user_id = $1', [userId]);
    await client.query('UPDATE system_logs SET user_id = NULL WHERE user_id = $1', [userId]);
    await client.query('UPDATE admin_audit_log SET actor_id = NULL WHERE actor_id = $1', [userId]);
    await client.query('UPDATE error_events SET resolved_by = NULL WHERE resolved_by = $1', [userId]);
    await client.query('UPDATE alert_history SET acknowledged_by = NULL WHERE acknowledged_by = $1', [userId]);
    await client.query('UPDATE config_change_log SET changed_by = NULL WHERE changed_by = $1', [userId]);
    await client.query('UPDATE group_members SET left_at = NOW() WHERE user_id = $1 AND left_at IS NULL', [userId]);
    await client.query('UPDATE group_sync SET updated_by = NULL WHERE updated_by = $1', [userId]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM push_subscriptions_web WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_reminders WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_restrictions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_activity_log WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  invalidateRestrictionCache(userId);
}

export async function getAnonymizedUsers(filters: { page?: number; limit?: number; status?: string; search?: string }): Promise<PaginatedResult<any>> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.search) {
    conditions.push(`u.display_name ILIKE $${paramIdx++}`);
    params.push(`%${filters.search}%`);
  }

  let statusJoin = '';
  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') {
      statusJoin = `LEFT JOIN LATERAL (
        SELECT type FROM user_restrictions ur
        WHERE ur.user_id = u.id AND ur.lifted_at IS NULL
        ORDER BY ur.created_at DESC LIMIT 1
      ) r ON true`;
      conditions.push('r.type IS NULL');
    } else {
      statusJoin = `JOIN LATERAL (
        SELECT type FROM user_restrictions ur
        WHERE ur.user_id = u.id AND ur.type = $${paramIdx++} AND ur.lifted_at IS NULL
        ORDER BY ur.created_at DESC LIMIT 1
      ) r ON true`;
      params.push(filters.status);
    }
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const [rowsResult, countResult] = await Promise.all([
    query<any>(
      `SELECT u.id,
              LEFT(ENCODE(sha256(u.email::bytea), 'hex'), 16) as email_hash,
              u.display_name,
              u.created_at,
              u.updated_at,
              (SELECT type FROM user_restrictions WHERE user_id = u.id AND lifted_at IS NULL ORDER BY created_at DESC LIMIT 1) as restriction_type
       FROM users u ${statusJoin}
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM users u ${statusJoin} ${where}`,
      params
    ),
  ]);

  return {
    items: rowsResult.rows.map(r => ({
      id: r.id,
      emailHash: r.email_hash?.slice(0, 16) || '',
      displayName: r.display_name,
      createdAt: r.created_at,
      status: r.restriction_type || 'active',
      lastActivity: r.updated_at,
    })),
    pagination: { page, limit, total: Number(countResult.rows[0]?.count || 0) },
  };
}

export async function getUserDetail(userId: string): Promise<any> {
  const [userResult, restrictionResult, activityResult, groupResult, blobResult] = await Promise.all([
    query<any>(
      `SELECT id, LEFT(ENCODE(sha256(email::bytea), 'hex'), 16) as email_hash,
              display_name, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    ),
    query<any>(
      `SELECT type, reason, created_at, expires_at FROM user_restrictions
       WHERE user_id = $1 AND lifted_at IS NULL ORDER BY created_at DESC`,
      [userId]
    ),
    query<any>(
      `SELECT COUNT(*) as count FROM user_activity_log WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    ),
    query<any>(
      `SELECT COUNT(*) as count FROM group_members WHERE user_id = $1 AND left_at IS NULL`,
      [userId]
    ),
    query<any>(
      `SELECT octet_length(personal_data_enc) as size FROM users WHERE id = $1`,
      [userId]
    ),
  ]);

  if (userResult.rows.length === 0) return null;

  const u = userResult.rows[0];
  return {
    id: u.id,
    emailHash: u.email_hash?.slice(0, 16) || '',
    displayName: u.display_name,
    createdAt: u.created_at,
    status: restrictionResult.rows.length > 0 ? restrictionResult.rows[0].type : 'active',
    restrictions: restrictionResult.rows,
    activity30d: Number(activityResult.rows[0]?.count || 0),
    groupCount: Number(groupResult.rows[0]?.count || 0),
    blobSizeBytes: Number(blobResult.rows[0]?.size || 0),
    lastActivity: u.updated_at,
  };
}

export async function getUserActivity(userId: string, page: number = 1, limit: number = 50): Promise<PaginatedResult<any>> {
  const offset = (page - 1) * limit;

  const [rowsResult, countResult] = await Promise.all([
    query<any>(
      `SELECT id, action, ip_address, user_agent, metadata, created_at
       FROM user_activity_log WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query<{ count: number }>('SELECT COUNT(*) as count FROM user_activity_log WHERE user_id = $1', [userId]),
  ]);

  return {
    items: rowsResult.rows,
    pagination: { page, limit, total: Number(countResult.rows[0]?.count || 0) },
  };
}
