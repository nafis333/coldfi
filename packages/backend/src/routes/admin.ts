import { FastifyInstance } from 'fastify';
import os from 'os';
import { requireAdmin, adminAudit, writeAdminAuditLog } from '../middleware';
import { query } from '../db/pool';
import * as monitoring from '../services/monitoringService';
import * as alerts from '../services/alertService';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAdmin);

  // ============================================================
  // SECTION A: DASHBOARD
  // ============================================================

  app.get('/admin/stats', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getAggregateStats());
  });

  app.get('/admin/stats/registrations', { preHandler: [adminAudit] }, async (request, reply) => {
    const { days = '30' } = request.query as any;
    return reply.send(await monitoring.getRegistrationRate(parseInt(days as string)));
  });

  app.get('/admin/stats/active-users', { preHandler: [adminAudit] }, async (request, reply) => {
    const { days = '30' } = request.query as any;
    return reply.send(await monitoring.getActiveUserTimeline(parseInt(days as string)));
  });

  // ============================================================
  // SECTION B: PERFORMANCE MONITORING
  // ============================================================

  app.get('/admin/monitoring/endpoints', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getEndpointMetrics(parseInt(hours as string)));
  });

  app.get('/admin/monitoring/errors', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getErrorRateOverview(parseInt(hours as string)));
  });

  app.get('/admin/monitoring/slow-queries', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24', minDuration = '500' } = request.query as any;
    return reply.send(await monitoring.getSlowQueries(parseInt(hours as string), parseInt(minDuration as string)));
  });

  app.get('/admin/monitoring/database', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getDatabaseHealth());
  });

  app.get('/admin/monitoring/database/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getDatabaseStatsHistory(parseInt(hours as string)));
  });

  app.get('/admin/monitoring/redis', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getRedisStats());
  });

  app.get('/admin/jobs', { preHandler: [adminAudit] }, async (request, reply) => {
    const queries = await monitoring.getRunningQueries();
    const active = queries.filter(q => q.state === 'active').length;
    const idle = queries.filter(q => q.state === 'idle').length;
    return reply.send({ active, idle, total: queries.length, queries });
  });

  // ============================================================
  // SECTION C: DEBUG TOOLS
  // ============================================================

  app.get('/admin/debug/logs', { preHandler: [adminAudit] }, async (request, reply) => {
    const { level, module, search, page = '1', limit = '50', from, to } = request.query as any;
    return reply.send(await monitoring.getSystemLogs({
      level: level as string,
      module: module as string,
      search: search as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      from: from as string,
      to: to as string,
    }));
  });

  app.get('/admin/debug/errors', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '20', resolved } = request.query as any;
    return reply.send(await monitoring.getErrorEvents({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      resolved: resolved as string,
    }));
  });

  app.get('/admin/debug/errors/:id', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const detail = await monitoring.getErrorDetail(parseInt(id as string));
    if (!detail) return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Error event not found' });
    return reply.send(detail);
  });

  app.post('/admin/debug/errors/:id/resolve', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    await monitoring.resolveError(parseInt(id as string), adminId);
    await writeAdminAuditLog('error_resolved', null, adminId, { errorId: parseInt(id as string) }, request.ip);
    return reply.send({ message: 'Error marked as resolved' });
  });

  app.get('/admin/debug/trace/:requestId', { preHandler: [adminAudit] }, async (request, reply) => {
    const { requestId } = request.params as any;
    const trace = await monitoring.getRequestTrace(requestId as string);
    if (!trace) return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Request trace not found' });
    return reply.send(trace);
  });

  app.get('/admin/debug/cache', { preHandler: [adminAudit] }, async (request, reply) => {
    const { pattern = '*' } = request.query as any;
    return reply.send(await monitoring.inspectRedisCache(pattern as string));
  });

  app.post('/admin/debug/cache/clear', { preHandler: [adminAudit] }, async (request, reply) => {
    const { pattern } = request.body as any;
    const adminId = request.user.userId;
    const deleted = await monitoring.clearRedisCache(pattern || '*');
    await writeAdminAuditLog('cache_cleared', null, adminId, { pattern: pattern || '*', deletedCount: deleted }, request.ip);
    return reply.send({ message: `Cache cleared: ${deleted} keys deleted` });
  });

  // ============================================================
  // SECTION D: USER MANAGEMENT
  // ============================================================

  app.get('/admin/users', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '50', status, search } = request.query as any;
    return reply.send(await monitoring.getAnonymizedUsers({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string,
      search: search as string,
    }));
  });

  app.get('/admin/users/:userId', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const detail = await monitoring.getUserDetail(userId as string);
    if (!detail) return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'User not found' });
    return reply.send(detail);
  });

  app.get('/admin/users/:userId/activity', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const { page = '1', limit = '50' } = request.query as any;
    return reply.send(await monitoring.getUserActivity(
      userId as string,
      parseInt(page as string),
      parseInt(limit as string)
    ));
  });

  app.post('/admin/users/:userId/force-logout', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await writeAdminAuditLog('force_logout', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'All sessions revoked' });
  });

  app.post('/admin/users/:userId/suspend', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const { reason, durationHours } = request.body as any;
    const adminId = request.user.userId;
    const expiresAt = durationHours ? new Date(Date.now() + parseInt(durationHours as string) * 3600000) : null;

    await query(
      `UPDATE user_restrictions SET lifted_at = NOW()
       WHERE user_id = $1 AND type = 'suspended' AND lifted_at IS NULL`,
      [userId]
    );

    await query(
      `INSERT INTO user_restrictions (user_id, type, reason, admin_id, expires_at, created_at)
       VALUES ($1, 'suspended', $2, $3, $4, NOW())`,
      [userId, reason || 'No reason provided', adminId, expiresAt]
    );
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await writeAdminAuditLog('user_suspended', userId as string, adminId, { reason, durationHours }, request.ip);
    return reply.send({ message: 'User suspended', expiresAt });
  });

  app.post('/admin/users/:userId/ban', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const { reason } = request.body as any;
    const adminId = request.user.userId;

    await query(
      `UPDATE user_restrictions SET lifted_at = NOW()
       WHERE user_id = $1 AND type = 'banned' AND lifted_at IS NULL`,
      [userId]
    );

    await query(
      `INSERT INTO user_restrictions (user_id, type, reason, admin_id, created_at)
       VALUES ($1, 'banned', $2, $3, NOW())`,
      [userId, reason || 'No reason provided', adminId]
    );
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await writeAdminAuditLog('user_banned', userId as string, adminId, { reason }, request.ip);
    return reply.send({ message: 'User banned. Data will be deleted after 30 days.' });
  });



  app.post('/admin/users/:userId/restore', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;
    await query(
      `UPDATE user_restrictions SET lifted_at = NOW()
       WHERE user_id = $1 AND lifted_at IS NULL`,
      [userId]
    );
    await writeAdminAuditLog('user_restored', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'User restrictions lifted' });
  });

  app.post('/admin/users/:userId/delete', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;

    await query('UPDATE slow_queries SET user_id = NULL WHERE user_id = $1', [userId]);
    await query('UPDATE system_logs SET user_id = NULL WHERE user_id = $1', [userId]);
    await query('UPDATE admin_audit_log SET actor_id = NULL WHERE actor_id = $1', [userId]);
    await query('UPDATE error_events SET resolved_by = NULL WHERE resolved_by = $1', [userId]);
    await query('UPDATE alert_history SET acknowledged_by = NULL WHERE acknowledged_by = $1', [userId]);
    await query('UPDATE config_change_log SET changed_by = NULL WHERE changed_by = $1', [userId]);
    await query('UPDATE group_members SET left_at = NOW() WHERE user_id = $1 AND left_at IS NULL', [userId]);
    await query('DELETE FROM user_restrictions WHERE user_id = $1', [userId]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await query('DELETE FROM user_activity_log WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    await writeAdminAuditLog('user_deleted', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'User and all associated data permanently deleted' });
  });

  // ============================================================
  // SECTION E: SECURITY DASHBOARD
  // ============================================================

  app.get('/admin/security/failed-logins', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getFailedLoginStats(parseInt(hours as string)));
  });

  app.get('/admin/security/suspicious-ips', { preHandler: [adminAudit] }, async (request, reply) => {
    const { threshold = '50', hours = '1' } = request.query as any;
    return reply.send(await monitoring.getSuspiciousIPs(parseInt(threshold as string), parseInt(hours as string)));
  });

  app.get('/admin/security/rate-limit-hits', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getRateLimitHits(parseInt(hours as string)));
  });

  app.get('/admin/security/score', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getSecurityScore());
  });

  app.post('/admin/security/block-ip', { preHandler: [adminAudit] }, async (request, reply) => {
    const { ipAddress, reason } = request.body as any;
    const adminId = request.user.userId;
    await monitoring.blockIPAddress(ipAddress as string, reason as string || 'Blocked by admin');
    await writeAdminAuditLog('ip_blocked', null, adminId, { ipAddress, reason }, request.ip);
    return reply.send({ message: `IP ${ipAddress} blocked` });
  });

  // ============================================================
  // SECTION F: ALERTS ENGINE
  // ============================================================

  app.get('/admin/alerts/rules', { preHandler: [adminAudit] }, async (request, reply) => {
    const rules = await query('SELECT * FROM alert_rules ORDER BY name');
    return reply.send(rules.rows);
  });

  app.post('/admin/alerts/rules', { preHandler: [adminAudit] }, async (request, reply) => {
    const rule = request.body as any;
    const adminId = request.user.userId;
    const { rows: [created] } = await query(
      `INSERT INTO alert_rules (name, metric, condition, threshold, window_minutes, enabled, channels, webhook_url, cooldown_minutes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        rule.name, rule.metric, rule.condition, rule.threshold,
        rule.windowMinutes || 5, rule.enabled !== false,
        rule.channels || ['panel'], rule.webhookUrl || null,
        rule.cooldownMinutes || 30,
      ]
    );
    await writeAdminAuditLog('alert_rule_created', null, adminId, { ruleId: created.id, name: rule.name }, request.ip);
    return reply.status(201).send(created);
  });

  app.put('/admin/alerts/rules/:id', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const updates = request.body as any;
    const { rows: [updated] } = await query(
      `UPDATE alert_rules SET name=$1, metric=$2, condition=$3, threshold=$4, window_minutes=$5, enabled=$6, channels=$7, webhook_url=$8, cooldown_minutes=$9
       WHERE id=$10 RETURNING *`,
      [
        updates.name, updates.metric, updates.condition, updates.threshold,
        updates.windowMinutes, updates.enabled, updates.channels,
        updates.webhookUrl, updates.cooldownMinutes, id,
      ]
    );
    if (!updated) return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Alert rule not found' });
    return reply.send(updated);
  });

  app.delete('/admin/alerts/rules/:id', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    const { rows: [deleted] } = await query('DELETE FROM alert_rules WHERE id = $1 RETURNING *', [id]);
    if (!deleted) return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Alert rule not found' });
    await writeAdminAuditLog('alert_rule_deleted', null, adminId, { ruleId: id, name: deleted.name }, request.ip);
    return reply.send({ message: 'Alert rule deleted' });
  });

  app.get('/admin/alerts/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '50', acknowledged } = request.query as any;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT ah.*, ar.name as rule_name FROM alert_history ah LEFT JOIN alert_rules ar ON ah.rule_id = ar.id';
    const params: any[] = [];

    if (acknowledged === 'false') {
      sql += ' WHERE ah.acknowledged = FALSE';
    }

    sql += ' ORDER BY ah.created_at DESC LIMIT $1 OFFSET $2';
    params.push(limitNum, offset);

    const [rowsResult, countResult] = await Promise.all([
      query(sql, params),
      query<{ count: number }>(
        'SELECT COUNT(*) as count FROM alert_history' + (acknowledged === 'false' ? ' WHERE acknowledged = FALSE' : '')
      ),
    ]);

    return reply.send({
      alerts: rowsResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: Number(countResult.rows[0]?.count || 0) },
    });
  });

  app.post('/admin/alerts/:id/acknowledge', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    await query(
      'UPDATE alert_history SET acknowledged = TRUE, acknowledged_by = $1 WHERE id = $2',
      [adminId, id]
    );
    await writeAdminAuditLog('alert_acknowledged', null, adminId, { alertId: id }, request.ip);
    return reply.send({ message: 'Alert acknowledged' });
  });

  app.post('/admin/alerts/rules/:id/test', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    return reply.send(await alerts.testAlertRule(id as string));
  });

  app.post('/admin/alerts/evaluate', { preHandler: [adminAudit] }, async (request, reply) => {
    await alerts.evaluateAlertRules();
    return reply.send({ message: 'Alert rules evaluated' });
  });

  // ============================================================
  // SECTION G: BACKGROUND JOBS
  // ============================================================

  app.get('/admin/jobs/queues', { preHandler: [adminAudit] }, async (_request, reply) => {
    return reply.send({ queues: [] });
  });

  app.get('/admin/jobs/queues/:queueName', { preHandler: [adminAudit] }, async (request, reply) => {
    const { queueName } = request.params as any;
    return reply.send({ queueName, detail: null });
  });

  app.get('/admin/jobs/queues/:queueName/failed', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send({ jobs: [], pagination: { page: 1, limit: 20, total: 0 } });
  });

  app.post('/admin/jobs/queues/:queueName/jobs/:jobId/retry', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send({ message: 'BullMQ not configured' });
  });

  // ============================================================
  // SECTION H: SYSTEM CONFIG
  // ============================================================

  app.get('/admin/config', { preHandler: [adminAudit] }, async (request, reply) => {
    const configs = await query('SELECT * FROM system_config ORDER BY key');
    return reply.send(configs.rows);
  });

  app.put('/admin/config/:key', { preHandler: [adminAudit] }, async (request, reply) => {
    const { key } = request.params as any;
    const { value, description } = request.body as any;
    const adminId = request.user.userId;

    const oldResult = await query('SELECT value FROM system_config WHERE key = $1', [key]);
    const oldValue = oldResult.rows[0]?.value || null;

    const storedValue = typeof value === 'string' ? value : JSON.stringify(value);
    await query(
      `INSERT INTO system_config (key, value, description, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, description = COALESCE($3, system_config.description), updated_by = $4, updated_at = NOW()`,
      [key, storedValue, description || null, adminId]
    );

    await query(
      `INSERT INTO config_change_log (config_key, old_value, new_value, changed_by, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [key, oldValue, storedValue, adminId, request.ip]
    );

    await writeAdminAuditLog('config_updated', null, adminId, { key, newValue: value }, request.ip);
    return reply.send({ key, value });
  });

  app.get('/admin/config/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { key } = request.query as any;
    let sql = 'SELECT * FROM config_change_log';
    const params: any[] = [];
    if (key) { sql += ' WHERE config_key = $1'; params.push(key); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    return reply.send(await query(sql, params));
  });

  app.post('/admin/maintenance', { preHandler: [adminAudit] }, async (request, reply) => {
    const { enabled, message } = request.body as any;
    const adminId = request.user.userId;
    const value = enabled ? 'true' : 'false';

    await query(
      `INSERT INTO system_config (key, value, description, updated_by, updated_at)
       VALUES ('app.maintenance_mode', $1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, description = COALESCE($2, system_config.description), updated_by = $3, updated_at = NOW()`,
      [value, message || null, adminId]
    );

    await writeAdminAuditLog('maintenance_toggle', null, adminId, { enabled, message }, request.ip);
    return reply.send({ maintenanceMode: enabled, message: message || null });
  });

  // ============================================================
  // SECTION I: ADMIN AUDIT LOG
  // ============================================================

  app.get('/admin/audit-log', { preHandler: [adminAudit] }, async (request, reply) => {
    const { action, page = '1', limit = '50' } = request.query as any;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT * FROM admin_audit_log';
    const params: any[] = [];

    if (action) {
      sql += ' WHERE action = $1';
      params.push(action);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limitNum, offset);

    const [rowsResult, countResult] = await Promise.all([
      query(sql, params),
      query<{ count: number }>(
        'SELECT COUNT(*) as count FROM admin_audit_log' + (action ? ' WHERE action = $1' : ''),
        action ? [action] : []
      ),
    ]);

    return reply.send({
      logs: rowsResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: Number(countResult.rows[0]?.count || 0) },
    });
  });

  // ============================================================
  // SECTION K: SYSTEM HEALTH
  // ============================================================

  app.get('/admin/health', { preHandler: [adminAudit] }, async (request, reply) => {
    const [db, redisResult, memory] = await Promise.all([
      monitoring.getDatabaseHealth(),
      (async () => { try { return await monitoring.getRedisStats(); } catch { return null; } })(),
      (async () => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        return { usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100) };
      })(),
    ]);

    const checks: Record<string, any> = {
      database: { status: db.activeConnections > 0 || db.totalConnections > 0 ? 'ok' : 'degraded', ...db },
      redis: redisResult ? { status: 'ok', ...redisResult } : { status: 'error' },
      memory: { status: memory.usedPercent > 90 ? 'critical' : memory.usedPercent > 80 ? 'warning' : 'ok', ...memory },
    };

    const hasErrors = Object.values(checks).some(c => c.status === 'error' || c.status === 'critical');
    return reply.status(hasErrors ? 503 : 200).send({
      status: hasErrors ? 'degraded' : 'healthy',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/admin/health/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getHealthHistory(parseInt(hours as string)));
  });
}
