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

export const getHealthHistory = getDatabaseStatsHistory;
