import { query } from '../db/pool';
import { cacheGet, cacheSet, getRedis } from './redis';
import { logger } from './logger';

export interface AggregateStats {
  totalUsers: number;
  totalGroups: number;
  totalBlobSizeBytes: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  activeUsers90d: number;
  regRateDaily: number;
  topGroups: { groupId: string; name: string; memberCount: number; blobSizeBytes: number }[];
}

export interface RegistrationDay {
  date: string;
  count: number;
}

export interface ActiveDay {
  date: string;
  activeUsers: number;
}

export interface StorageDay {
  date: string;
  totalTableSizeMb: number;
}

export interface EndpointMetric {
  endpoint: string;
  method: string;
  totalCalls: number;
  errorCount: number;
  errorRate: number;
  avgDuration: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export interface ErrorRateOverview {
  hourlyBreakdown: { hour: string; error4xx: number; error5xx: number; totalCalls: number }[];
  spikes: { hour: string; errorRate: number }[];
}

export interface SlowQuery {
  id: number;
  queryText: string;
  durationMs: number;
  caller: string;
  userId: string | null;
  occurredAt: string;
}

export interface DatabaseHealth {
  activeConnections: number;
  totalConnections: number;
  waitingCount: number;
  totalDbSizeMb: number;
  cacheHitRatio: number;
}

export interface RedisStats {
  usedMemoryMb: number;
  connectedClients: number;
  hitRate: number;
}

export interface SystemLog {
  id: number;
  level: string;
  module: string;
  message: string;
  metadata: any;
  requestId: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ErrorEvent {
  id: number;
  errorCode: string;
  errorMessage: string;
  module: string;
  occurrenceCount: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

export interface RequestTrace {
  requestId: string;
  steps: { timestamp: string; level: string; module: string; message: string }[];
  errors: { timestamp: string; message: string }[];
}

export interface AnonymizedUser {
  id: string;
  emailHash: string;
  displayName: string | null;
  createdAt: string;
  status: 'active' | 'suspended' | 'banned';
  lastActivity: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number };
}

export async function getAggregateStats(): Promise<AggregateStats> {
  const cached = await cacheGet<AggregateStats>('admin:stats:aggregate');
  if (cached) return cached;

  const [userCount, groupCount, active24h, active7d, active30d, active90d, regToday, regYesterday, blobResult, topGroupsResult] = await Promise.all([
    query<{ count: number }>('SELECT COUNT(*) as count FROM users'),
    query<{ count: number }>('SELECT COUNT(*) as count FROM groups'),
    query<{ count: number }>("SELECT COUNT(DISTINCT user_id) as count FROM user_activity_log WHERE action = 'login_success' AND created_at > NOW() - INTERVAL '24 hours'"),
    query<{ count: number }>("SELECT COUNT(DISTINCT user_id) as count FROM user_activity_log WHERE action = 'login_success' AND created_at > NOW() - INTERVAL '7 days'"),
    query<{ count: number }>("SELECT COUNT(DISTINCT user_id) as count FROM user_activity_log WHERE action = 'login_success' AND created_at > NOW() - INTERVAL '30 days'"),
    query<{ count: number }>("SELECT COUNT(DISTINCT user_id) as count FROM user_activity_log WHERE action = 'login_success' AND created_at > NOW() - INTERVAL '90 days'"),
    query<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE created_at > CURRENT_DATE"),
    query<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE"),
    query<{ sum: number | null }>('SELECT SUM(octet_length(personal_data_enc)) as sum FROM users'),
    query<{ id: string; name: string; member_count: number; blob_size: number | null }>(
      `SELECT g.id, g.name, gm.member_count, u.blob_size
       FROM groups g
       LEFT JOIN (SELECT group_id, COUNT(*) as member_count FROM group_members WHERE left_at IS NULL GROUP BY group_id) gm ON gm.group_id = g.id
       LEFT JOIN (SELECT id, octet_length(personal_data_enc) as blob_size FROM users) u ON u.id = g.created_by
       ORDER BY gm.member_count DESC NULLS LAST
       LIMIT 5`
    ),
  ]);

  const stats: AggregateStats = {
    totalUsers: Number(userCount.rows[0]?.count || 0),
    totalGroups: Number(groupCount.rows[0]?.count || 0),
    totalBlobSizeBytes: Number(blobResult.rows[0]?.sum || 0),
    activeUsers24h: Number(active24h.rows[0]?.count || 0),
    activeUsers7d: Number(active7d.rows[0]?.count || 0),
    activeUsers30d: Number(active30d.rows[0]?.count || 0),
    activeUsers90d: Number(active90d.rows[0]?.count || 0),
    regRateDaily: Math.round((Number(regToday.rows[0]?.count || 0) + Number(regYesterday.rows[0]?.count || 0)) / 2),
    topGroups: topGroupsResult.rows.map(r => ({
      groupId: r.id,
      name: r.name,
      memberCount: Number(r.member_count || 0),
      blobSizeBytes: Number(r.blob_size || 0),
    })),
  };

  await cacheSet('admin:stats:aggregate', stats, 30);
  return stats;
}

export async function getRegistrationRate(days: number): Promise<RegistrationDay[]> {
  const result = await query<{ date: string; count: number }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM users WHERE created_at > NOW() - $1::interval
     GROUP BY date ORDER BY date`,
    [`${days} days`]
  );
  return result.rows.map(r => ({ date: r.date, count: Number(r.count) }));
}

export async function getActiveUserTimeline(days: number): Promise<ActiveDay[]> {
  const result = await query<{ date: string; activeUsers: number }>(
    `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as "activeUsers"
     FROM user_activity_log
     WHERE action = 'login_success' AND created_at > NOW() - $1::interval
     GROUP BY date ORDER BY date`,
    [`${days} days`]
  );
  return result.rows.map(r => ({ date: r.date, activeUsers: Number(r.activeUsers) }));
}

export async function getEndpointMetrics(hours: number): Promise<EndpointMetric[]> {
  const rows = await query<any>(
    `SELECT endpoint, method,
            SUM(count) as total_calls,
            SUM(CASE WHEN status_group = '5xx' THEN count ELSE 0 END) as error_count,
            SUM(total_duration_ms) as total_duration,
            MAX(max_duration_ms) as max_duration
     FROM api_metrics_hourly
     WHERE hour_bucket > NOW() - $1::interval
     GROUP BY endpoint, method
     ORDER BY total_calls DESC`,
    [`${hours} hours`]
  );

  return rows.rows.map(r => {
    const totalCalls = Number(r.total_calls);
    const errorCount = Number(r.error_count);
    const totalDuration = Number(r.total_duration);
    return {
      endpoint: r.endpoint,
      method: r.method,
      totalCalls,
      errorCount,
      errorRate: totalCalls > 0 ? Math.round((errorCount / totalCalls) * 10000) / 100 : 0,
      avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      p50: null,
      p95: null,
      p99: null,
    };
  });
}

export async function getErrorRateOverview(hours: number): Promise<ErrorRateOverview> {
  const rows = await query<any>(
    `SELECT date_trunc('hour', hour_bucket) as hour,
            SUM(CASE WHEN status_group = '4xx' THEN count ELSE 0 END) as error_4xx,
            SUM(CASE WHEN status_group = '5xx' THEN count ELSE 0 END) as error_5xx,
            SUM(count) as total_calls
     FROM api_metrics_hourly
     WHERE hour_bucket > NOW() - $1::interval
     GROUP BY date_trunc('hour', hour_bucket)
     ORDER BY hour`,
    [`${hours} hours`]
  );

  const hourlyBreakdown = rows.rows.map(r => ({
    hour: r.hour,
    error4xx: Number(r.error_4xx),
    error5xx: Number(r.error_5xx),
    totalCalls: Number(r.total_calls),
  }));

  const spikes = hourlyBreakdown
    .filter(h => h.totalCalls > 0 && ((h.error4xx + h.error5xx) / h.totalCalls) > 0.05)
    .map(h => ({
      hour: h.hour,
      errorRate: Math.round(((h.error4xx + h.error5xx) / h.totalCalls) * 10000) / 100,
    }));

  return { hourlyBreakdown, spikes };
}

export async function getSlowQueries(hours: number, minDuration: number = 500): Promise<SlowQuery[]> {
  const result = await query<SlowQuery>(
    `SELECT id, query_text as "queryText", duration_ms as "durationMs", caller, user_id as "userId", occurred_at as "occurredAt"
     FROM slow_queries
     WHERE occurred_at > NOW() - $1::interval AND duration_ms >= $2
     ORDER BY duration_ms DESC
     LIMIT 100`,
    [`${hours} hours`, minDuration]
  );
  return result.rows;
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const [activity, dbSize, cacheHit] = await Promise.all([
    query<any>(`SELECT count(*) filter (where state = 'active') as active,
                        count(*) as total,
                        count(*) filter (where wait_event_type IS NOT NULL) as waiting
                 FROM pg_stat_activity WHERE datname = current_database()`),
    query<any>(`SELECT pg_database_size(current_database()) as size`),
    query<any>(`SELECT SUM(heap_blks_hit)::float / GREATEST(SUM(heap_blks_hit + heap_blks_read), 1) as hit_ratio
                FROM pg_statio_user_tables`),
  ]);

  return {
    activeConnections: Number(activity.rows[0]?.active || 0),
    totalConnections: Number(activity.rows[0]?.total || 0),
    waitingCount: Number(activity.rows[0]?.waiting || 0),
    totalDbSizeMb: Math.round(Number(dbSize.rows[0]?.size || 0) / (1024 * 1024) * 100) / 100,
    cacheHitRatio: Math.round(Number(cacheHit.rows[0]?.hit_ratio || 0) * 10000) / 10000,
  };
}

export interface RunningQuery {
  pid: number;
  state: string;
  query: string;
  duration: number | null;
  waitEventType: string | null;
  waitEvent: string | null;
  clientAddr: string | null;
  startedAt: string;
}

export async function getRunningQueries(): Promise<RunningQuery[]> {
  const result = await query<any>(
    `SELECT pid, state, query, EXTRACT(EPOCH FROM NOW() - query_start) * 1000 as duration,
            wait_event_type, wait_event, client_addr,
            TO_CHAR(query_start, 'YYYY-MM-DD HH24:MI:SS') as started_at
     FROM pg_stat_activity
     WHERE datname = current_database()
       AND state = 'active'
       AND pid <> pg_backend_pid()
     ORDER BY query_start DESC
     LIMIT 50`
  );
  return result.rows.map(r => ({
    pid: r.pid,
    state: r.state,
    query: r.query,
    duration: r.duration !== null ? Math.round(Number(r.duration)) : null,
    waitEventType: r.wait_event_type,
    waitEvent: r.wait_event,
    clientAddr: r.client_addr,
    startedAt: r.started_at,
  }));
}

export async function getDatabaseStatsHistory(hours: number): Promise<any[]> {
  const result = await query(
    `SELECT * FROM db_stats_snapshots
     WHERE snapshot_at > NOW() - $1::interval
     ORDER BY snapshot_at DESC`,
    [`${hours} hours`]
  );
  return result.rows;
}

export async function getRedisStats(): Promise<RedisStats> {
  try {
    const redis = getRedis();
    const info = await redis.info();
    const usedMemoryMb = Math.round(parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0', 10) / (1024 * 1024) * 100) / 100;
    const connectedClients = parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0', 10);
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0', 10);
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0', 10);
    const hitRate = (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 10000) / 100 : 0;
    return { usedMemoryMb, connectedClients, hitRate };
  } catch (err) {
    logger.error('getRedisStats failed', { module: 'monitoring', error: String(err) });
    return { usedMemoryMb: 0, connectedClients: 0, hitRate: 0 };
  }
}

export async function getSystemLogs(filters: {
  level?: string;
  module?: string;
  search?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PaginatedResult<SystemLog>> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.level) {
    conditions.push(`level = $${paramIdx++}`);
    params.push(filters.level);
  }
  if (filters.module) {
    conditions.push(`module = $${paramIdx++}`);
    params.push(filters.module);
  }
  if (filters.search) {
    conditions.push(`message ILIKE $${paramIdx++}`);
    params.push(`%${filters.search}%`);
  }
  if (filters.from) {
    conditions.push(`created_at >= $${paramIdx++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`created_at <= $${paramIdx++}`);
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const [rowsResult, countResult] = await Promise.all([
    query<SystemLog>(
      `SELECT id, level, module, message, metadata, request_id as "requestId", user_id as "userId", ip_address as "ipAddress", created_at as "createdAt"
       FROM system_logs ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    query<{ count: number }>(`SELECT COUNT(*) as count FROM system_logs ${where}`, params),
  ]);

  return {
    items: rowsResult.rows,
    pagination: { page, limit, total: Number(countResult.rows[0]?.count || 0) },
  };
}

export async function getErrorEvents(filters: { page?: number; limit?: number; resolved?: string }): Promise<PaginatedResult<ErrorEvent>> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  let where = '';
  const params: any[] = [];

  if (filters.resolved === 'false') {
    where = 'WHERE resolved = FALSE';
  } else if (filters.resolved === 'true') {
    where = 'WHERE resolved = TRUE';
  }

  const [rowsResult, countResult] = await Promise.all([
    query<ErrorEvent>(
      `SELECT id, error_code as "errorCode", error_message as "errorMessage", module,
              occurrence_count as "occurrenceCount", affected_users as "affectedUsers",
              first_seen as "firstSeen", last_seen as "lastSeen", resolved
       FROM error_events ${where}
       ORDER BY occurrence_count DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query<{ count: number }>(`SELECT COUNT(*) as count FROM error_events ${where}`, params),
  ]);

  return {
    items: rowsResult.rows,
    pagination: { page, limit, total: Number(countResult.rows[0]?.count || 0) },
  };
}

export async function getErrorDetail(id: number): Promise<any> {
  const [errorResult, relatedLogs] = await Promise.all([
    query<any>(
      `SELECT id, error_code, error_message, stack_hash, module, first_seen, last_seen,
              occurrence_count, affected_users, sample_trace, resolved, resolved_by, resolved_at
       FROM error_events WHERE id = $1`,
      [id]
    ),
    query<any>(
      `SELECT id, level, module, message, created_at, metadata
       FROM system_logs WHERE metadata->>'stackHash' = (SELECT stack_hash FROM error_events WHERE id = $1)
       ORDER BY created_at DESC LIMIT 20`,
      [id]
    ),
  ]);

  if (errorResult.rows.length === 0) return null;

  const e = errorResult.rows[0];
  return {
    ...e,
    relatedLogs: relatedLogs.rows,
  };
}

export async function resolveError(id: number, adminId: string): Promise<void> {
  await query(
    `UPDATE error_events SET resolved = TRUE, resolved_by = $1, resolved_at = NOW() WHERE id = $2`,
    [adminId, id]
  );
}

export async function getRequestTrace(requestId: string): Promise<RequestTrace | null> {
  const logs = await query<any>(
    `SELECT created_at as timestamp, level, module, message
     FROM system_logs WHERE request_id = $1
     ORDER BY created_at ASC`,
    [requestId]
  );

  if (logs.rows.length === 0) return null;

  return {
    requestId,
    steps: logs.rows.map(r => ({ timestamp: r.timestamp, level: r.level, module: r.module, message: r.message })),
    errors: logs.rows.filter(r => r.level === 'error').map(r => ({ timestamp: r.timestamp, message: r.message })),
  };
}

export async function getAnonymizedUsers(filters: { page?: number; limit?: number; status?: string; search?: string }): Promise<PaginatedResult<AnonymizedUser>> {
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

export async function getFailedLoginStats(hours: number): Promise<any> {
  const [totalResult, ipResult, emailResult, timelineResult] = await Promise.all([
    query<any>(
      `SELECT COUNT(*) as total FROM user_activity_log WHERE action = 'login_failed' AND created_at > NOW() - $1::interval`,
      [`${hours} hours`]
    ),
    query<any>(
      `SELECT ip_address, COUNT(*) as count FROM user_activity_log
       WHERE action = 'login_failed' AND created_at > NOW() - $1::interval AND ip_address IS NOT NULL
       GROUP BY ip_address ORDER BY count DESC LIMIT 20`,
      [`${hours} hours`]
    ),
    query<any>(
      `SELECT LEFT(ENCODE(sha256(u.email::bytea), 'hex'), 16) as user_id, COUNT(*) as count FROM user_activity_log al
       JOIN users u ON u.id = al.user_id
       WHERE al.action = 'login_failed' AND al.created_at > NOW() - $1::interval
       GROUP BY u.id ORDER BY count DESC LIMIT 20`,
      [`${hours} hours`]
    ),
    query<any>(
      `SELECT date_trunc('hour', created_at) as hour, COUNT(*) as count
       FROM user_activity_log WHERE action = 'login_failed' AND created_at > NOW() - $1::interval
       GROUP BY date_trunc('hour', created_at) ORDER BY hour`,
      [`${hours} hours`]
    ),
  ]);

  return {
    totalAttempts: Number(totalResult.rows[0]?.total || 0),
    topIPs: ipResult.rows.map(r => ({ ip: r.ip_address, count: Number(r.count) })),
    topEmails: emailResult.rows.map(r => ({ emailHash: r.email.slice(0, 8) + '...', count: Number(r.count) })),
    timeline: timelineResult.rows.map(r => ({ hour: r.hour, count: Number(r.count) })),
  };
}

export async function getSuspiciousIPs(threshold: number = 50, hours: number = 1): Promise<any[]> {
  const result = await query<any>(
    `SELECT ip_address, COUNT(*) as failed_count, MIN(created_at) as first_seen, MAX(created_at) as last_seen,
            array_agg(DISTINCT user_agent) as user_agents
     FROM user_activity_log
     WHERE action = 'login_failed' AND created_at > NOW() - $1::interval AND ip_address IS NOT NULL
     GROUP BY ip_address
     HAVING COUNT(*) >= $2
     ORDER BY failed_count DESC`,
    [`${hours} hours`, threshold]
  );
  return result.rows.map(r => ({
    ipAddress: r.ip_address,
    failedCount: Number(r.failed_count),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    userAgents: r.user_agents,
  }));
}

export async function getRateLimitHits(hours: number): Promise<any[]> {
  const result = await query<any>(
    `SELECT module as endpoint, ip_address, COUNT(*) as count
     FROM system_logs
     WHERE level = 'warn' AND module LIKE '%rate%limit%' AND created_at > NOW() - $1::interval
     GROUP BY module, ip_address
     ORDER BY count DESC
     LIMIT 50`,
    [`${hours} hours`]
  );
  return result.rows.map(r => ({
    endpoint: r.endpoint,
    ip: r.ip_address,
    count: Number(r.count),
  }));
}

export async function getSecurityScore(): Promise<any> {
  const [totalUsers, twoFAUsers, totalLogins, failedLogins, rateLimitHits, suspiciousIPs] = await Promise.all([
    query<{ count: number }>('SELECT COUNT(*) as count FROM users'),
    query<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE two_factor_enabled = TRUE'),
    query<{ count: number }>("SELECT COUNT(*) as count FROM user_activity_log WHERE action = 'login_success' AND created_at > NOW() - INTERVAL '24 hours'"),
    query<{ count: number }>("SELECT COUNT(*) as count FROM user_activity_log WHERE action = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'"),
    query<{ count: number }>("SELECT COUNT(*) as count FROM system_logs WHERE level = 'warn' AND module LIKE '%rate%limit%' AND created_at > NOW() - INTERVAL '24 hours'"),
    query<any>("SELECT ip_address FROM user_activity_log WHERE action = 'login_failed' AND created_at > NOW() - INTERVAL '1 hour' GROUP BY ip_address HAVING COUNT(*) >= 50"),
  ]);

  const total = Number(totalUsers.rows[0]?.count || 1);
  const twoFAPct = Number(twoFAUsers.rows[0]?.count || 0) / total;
  const failedRatio = (Number(totalLogins.rows[0]?.count || 0) + Number(failedLogins.rows[0]?.count || 0)) > 0
    ? (Number(failedLogins.rows[0]?.count || 0) / (Number(totalLogins.rows[0]?.count || 0) + Number(failedLogins.rows[0]?.count || 0)))
    : 0;
  const rateLimitCount = Number(rateLimitHits.rows[0]?.count || 0);
  const suspiciousIPCount = suspiciousIPs.rows.length;

  const factorScores = [
    { name: '2FA Adoption', weight: 0.3, value: twoFAPct, impact: twoFAPct >= 0.5 ? 0 : (0.5 - twoFAPct) * 2 },
    { name: 'Login Failure Ratio', weight: 0.25, value: failedRatio, impact: failedRatio > 0.1 ? (failedRatio - 0.1) * 5 : 0 },
    { name: 'Rate Limit Hits', weight: 0.2, value: rateLimitCount, impact: Math.min(rateLimitCount / 100, 1) },
    { name: 'Suspicious IPs', weight: 0.25, value: suspiciousIPCount, impact: Math.min(suspiciousIPCount / 10, 1) },
  ];

  const rawScore = factorScores.reduce((acc, f) => acc + (1 - f.impact) * f.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 100)));

  const recommendations: string[] = [];
  if (twoFAPct < 0.5) recommendations.push('Enable 2FA enforcement for all users');
  if (failedRatio > 0.1) recommendations.push('Investigate failed login attempts — unusually high failure rate');
  if (rateLimitCount > 10) recommendations.push('Review rate limit configuration — multiple hits detected');
  if (suspiciousIPCount > 0) recommendations.push(`Block ${suspiciousIPCount} suspicious IP addresses`);

  return { score, factors: factorScores, recommendations };
}

export async function blockIPAddress(ipAddress: string, reason: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.sadd('admin:blocked_ips', ipAddress);
    await redis.hset(`admin:blocked_ip:${ipAddress}`, { reason, blockedAt: new Date().toISOString() });
  } catch (err) {
    logger.error('Failed to block IP in Redis', { module: 'monitoring', error: String(err) });
  }
}

export async function getHealthHistory(hours: number): Promise<any[]> {
  const result = await query(
    `SELECT * FROM db_stats_snapshots
     WHERE snapshot_at > NOW() - $1::interval
     ORDER BY snapshot_at DESC`,
    [`${hours} hours`]
  );
  return result.rows;
}

export async function inspectRedisCache(pattern: string): Promise<any> {
  try {
    const redis = getRedis();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0' && keys.length < 1000);

    const sampleKeys = keys.slice(0, 20);
    const totalEstimatedMemory = keys.length * 512;

    return { keyCount: keys.length, totalEstimatedMemory, sampleKeys };
  } catch (err) {
    logger.error('inspectRedisCache failed', { module: 'monitoring', error: String(err) });
    return { keyCount: 0, totalEstimatedMemory: 0, sampleKeys: [] };
  }
}

export async function clearRedisCache(pattern: string): Promise<number> {
  try {
    const redis = getRedis();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (err) {
    logger.error('clearRedisCache failed', { module: 'monitoring', error: String(err) });
    return 0;
  }
}
