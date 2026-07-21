import { query } from '../db/pool';
import { getRedis } from './redis';
import { logger } from './logger';

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
    topEmails: emailResult.rows.map(r => ({ emailHash: String(r.user_id).slice(0, 8) + '...', count: Number(r.count) })),
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
