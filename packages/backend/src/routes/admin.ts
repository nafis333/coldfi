import { FastifyInstance } from 'fastify';
import os from 'os';
import { requireAdmin, adminAudit, writeAdminAuditLog, adminRateLimit, stopCleanupTimer } from '../middleware';
import { safeParseInt } from '../utils/parse';
import { AppError, ValidationError, NotFoundError } from '../errors';
import * as monitoring from '../services/monitoringService';
import * as alerts from '../services/alertService';
import * as adminUser from '../services/adminUserService';
import * as adminConfig from '../services/adminConfigService';
import * as adminAlert from '../services/adminAlertService';
import * as adminAuditSvc from '../services/adminAuditService';
import * as adminLog from '../services/adminLogService';
import * as adminSecurity from '../services/adminSecurityService';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireAdmin);
  app.addHook('preHandler', adminRateLimit);
  app.addHook('onClose', async () => { stopCleanupTimer(); });

  // ============================================================
  // SECTION A: DASHBOARD
  // ============================================================

  app.get('/admin/stats', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getAggregateStats());
  });

  app.get('/admin/stats/registrations', { preHandler: [adminAudit] }, async (request, reply) => {
    const { days = '30' } = request.query as any;
    return reply.send(await monitoring.getRegistrationRate(safeParseInt(days, 30)));
  });

  app.get('/admin/stats/active-users', { preHandler: [adminAudit] }, async (request, reply) => {
    const { days = '30' } = request.query as any;
    return reply.send(await monitoring.getActiveUserTimeline(safeParseInt(days, 30)));
  });

  // ============================================================
  // SECTION B: PERFORMANCE MONITORING
  // ============================================================

  app.get('/admin/monitoring/endpoints', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getEndpointMetrics(safeParseInt(hours, 24)));
  });

  app.get('/admin/monitoring/errors', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getErrorRateOverview(safeParseInt(hours, 24)));
  });

  app.get('/admin/monitoring/slow-queries', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24', minDuration = '500' } = request.query as any;
    return reply.send(await monitoring.getSlowQueries(safeParseInt(hours, 24), safeParseInt(minDuration, 500)));
  });

  app.get('/admin/monitoring/database', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await monitoring.getDatabaseHealth());
  });

  app.get('/admin/monitoring/database/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await monitoring.getDatabaseStatsHistory(safeParseInt(hours, 24)));
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
    return reply.send(await adminLog.getSystemLogs({
      level: level as string,
      module: module as string,
      search: search as string,
      page: safeParseInt(page, 1),
      limit: safeParseInt(limit, 50),
      from: from as string,
      to: to as string,
    }));
  });

  app.get('/admin/debug/errors', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '20', resolved } = request.query as any;
    return reply.send(await adminLog.getErrorEvents({
      page: safeParseInt(page, 1),
      limit: safeParseInt(limit, 50),
      resolved: resolved as string,
    }));
  });

  app.get('/admin/debug/errors/:id', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const detail = await adminLog.getErrorDetail(safeParseInt(id, 0));
    if (!detail) throw new NotFoundError('Error event');
    return reply.send(detail);
  });

  app.post('/admin/debug/errors/:id/resolve', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    await adminLog.resolveError(safeParseInt(id, 0), adminId);
    await writeAdminAuditLog('error_resolved', null, adminId, { errorId: safeParseInt(id, 0) }, request.ip);
    return reply.send({ message: 'Error marked as resolved' });
  });

  app.get('/admin/debug/trace/:requestId', { preHandler: [adminAudit] }, async (request, reply) => {
    const { requestId } = request.params as any;
    const trace = await adminLog.getRequestTrace(requestId as string);
    if (!trace) throw new NotFoundError('Request trace');
    return reply.send(trace);
  });

  app.get('/admin/debug/cache', { preHandler: [adminAudit] }, async (request, reply) => {
    const { pattern = '*' } = request.query as any;
    return reply.send(await adminSecurity.inspectRedisCache(pattern as string));
  });

  app.post('/admin/debug/cache/clear', { preHandler: [adminAudit] }, async (request, reply) => {
    const { pattern } = request.body as any;
    const adminId = request.user.userId;
    const deleted = await adminSecurity.clearRedisCache(pattern || '*');
    await writeAdminAuditLog('cache_cleared', null, adminId, { pattern: pattern || '*', deletedCount: deleted }, request.ip);
    return reply.send({ message: `Cache cleared: ${deleted} keys deleted` });
  });

  // ============================================================
  // SECTION D: USER MANAGEMENT
  // ============================================================

  app.get('/admin/users', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '50', status, search } = request.query as any;
    return reply.send(await adminUser.getAnonymizedUsers({
      page: safeParseInt(page, 1),
      limit: safeParseInt(limit, 50),
      status: status as string,
      search: search as string,
    }));
  });

  app.get('/admin/users/:userId', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const detail = await adminUser.getUserDetail(userId as string);
    if (!detail) throw new NotFoundError('User');
    return reply.send(detail);
  });

  app.get('/admin/users/:userId/activity', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const { page = '1', limit = '50' } = request.query as any;
    return reply.send(await adminUser.getUserActivity(
      userId as string,
      safeParseInt(page, 1),
      safeParseInt(limit, 50)
    ));
  });

  app.post('/admin/users/:userId/force-logout', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;
    await adminUser.forceLogoutUser(userId as string);
    await writeAdminAuditLog('force_logout', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'All sessions revoked' });
  });

  app.post('/admin/users/:userId/suspend', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        required: ['durationHours'],
        properties: {
          durationHours: { type: 'number', minimum: 1 },
          reason: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as any;
    const { reason, durationHours } = request.body as any;
    const adminId = request.user.userId;

    const expiresAt = await adminUser.suspendUser(userId as string, reason || 'No reason provided', durationHours, adminId);
    await writeAdminAuditLog('user_suspended', userId as string, adminId, { reason, durationHours }, request.ip);
    return reply.send({ message: 'User suspended', expiresAt });
  });

  app.post('/admin/users/:userId/ban', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as any;
    const { reason } = request.body as any;
    const adminId = request.user.userId;

    await adminUser.banUser(userId as string, reason || 'No reason provided', adminId);
    await writeAdminAuditLog('user_banned', userId as string, adminId, { reason }, request.ip);
    return reply.send({ message: 'User banned. Data will be deleted after 30 days.' });
  });

  app.post('/admin/users/:userId/restore', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;
    await adminUser.restoreUser(userId as string);
    await writeAdminAuditLog('user_restored', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'User restrictions lifted' });
  });

  app.post('/admin/users/:userId/delete', { preHandler: [adminAudit] }, async (request, reply) => {
    const { userId } = request.params as any;
    const adminId = request.user.userId;

    if (adminId === userId) {
      throw new AppError('ERR_SELF_DELETE', 'Cannot delete your own account', 400);
    }

    try {
      await adminUser.deleteUser(userId as string, adminId);
    } catch (e: any) {
      if (e.message === 'ERR_LAST_OWNER') {
        throw new AppError('ERR_LAST_OWNER', 'Cannot delete the last owner account', 400);
      }
      throw e;
    }

    await writeAdminAuditLog('user_deleted', userId as string, adminId, {}, request.ip);
    return reply.send({ message: 'User and all associated data permanently deleted' });
  });

  // ============================================================
  // SECTION E: SECURITY DASHBOARD
  // ============================================================

  app.get('/admin/security/failed-logins', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await adminSecurity.getFailedLoginStats(safeParseInt(hours, 24)));
  });

  app.get('/admin/security/suspicious-ips', { preHandler: [adminAudit] }, async (request, reply) => {
    const { threshold = '50', hours = '1' } = request.query as any;
    return reply.send(await adminSecurity.getSuspiciousIPs(safeParseInt(threshold, 50), safeParseInt(hours, 24)));
  });

  app.get('/admin/security/rate-limit-hits', { preHandler: [adminAudit] }, async (request, reply) => {
    const { hours = '24' } = request.query as any;
    return reply.send(await adminSecurity.getRateLimitHits(safeParseInt(hours, 24)));
  });

  app.get('/admin/security/score', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await adminSecurity.getSecurityScore());
  });

  app.post('/admin/security/block-ip', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        required: ['ipAddress'],
        properties: {
          ipAddress: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { ipAddress, reason } = request.body as any;
    const adminId = request.user.userId;

    const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
    const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    if (!IPV4_REGEX.test(ipAddress) && !IPV6_REGEX.test(ipAddress)) {
      throw new ValidationError('ipAddress must be a valid IP address');
    }

    await adminSecurity.blockIPAddress(ipAddress, reason || 'Blocked by admin');
    await writeAdminAuditLog('ip_blocked', null, adminId, { ipAddress, reason }, request.ip);
    return reply.send({ message: `IP ${ipAddress} blocked` });
  });

  // ============================================================
  // SECTION F: ALERTS ENGINE
  // ============================================================

  app.get('/admin/alerts/rules', { preHandler: [adminAudit] }, async (request, reply) => {
    return reply.send(await adminAlert.getAlertRules());
  });

  app.post('/admin/alerts/rules', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'metric', 'condition', 'threshold'],
        properties: {
          name: { type: 'string', minLength: 1 },
          metric: { type: 'string', minLength: 1 },
          condition: { type: 'string', enum: ['>', '<', '>=', '<=', '=='] },
          threshold: { type: 'number' },
          window_minutes: { type: 'number', minimum: 1 },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          enabled: { type: 'boolean' },
          channels: { type: 'array', items: { type: 'string' } },
          webhook_url: { type: 'string' },
          cooldown_minutes: { type: 'number', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const rule = request.body as any;
    const adminId = request.user.userId;
    const created = await adminAlert.createAlertRule(rule, adminId);
    await writeAdminAuditLog('alert_rule_created', null, adminId, { ruleId: created.id, name: rule.name }, request.ip);
    return reply.status(201).send(created);
  });

  app.put('/admin/alerts/rules/:id', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          metric: { type: 'string', minLength: 1 },
          condition: { type: 'string', enum: ['>', '<', '>=', '<=', '=='] },
          threshold: { type: 'number' },
          window_minutes: { type: 'number', minimum: 1 },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          enabled: { type: 'boolean' },
          channels: { type: 'array', items: { type: 'string' } },
          webhook_url: { type: 'string' },
          cooldown_minutes: { type: 'number', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const updated = await adminAlert.updateAlertRule(id as string, request.body as any);
    if (!updated) throw new NotFoundError('Alert rule');
    return reply.send(updated);
  });

  app.delete('/admin/alerts/rules/:id', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    const deleted = await adminAlert.deleteAlertRule(id as string);
    if (!deleted) throw new NotFoundError('Alert rule');
    await writeAdminAuditLog('alert_rule_deleted', null, adminId, { ruleId: id, name: deleted.name }, request.ip);
    return reply.send({ message: 'Alert rule deleted' });
  });

  app.get('/admin/alerts/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { page = '1', limit = '50', acknowledged } = request.query as any;
    return reply.send(await adminAlert.getAlertHistory(
      safeParseInt(page, 1),
      Math.min(safeParseInt(limit, 50), 100),
      acknowledged as string
    ));
  });

  app.post('/admin/alerts/:id/acknowledge', { preHandler: [adminAudit] }, async (request, reply) => {
    const { id } = request.params as any;
    const adminId = request.user.userId;
    await adminAlert.acknowledgeAlert(id as string, adminId);
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
    return reply.send(await adminConfig.getConfig());
  });

  app.put('/admin/config/:key', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {},
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { key } = request.params as any;
    const { value, description } = request.body as any;
    const adminId = request.user.userId;

    const result = await adminConfig.updateConfig(key as string, value, description || null, adminId, request.ip);
    await writeAdminAuditLog('config_updated', null, adminId, { key, newValue: value }, request.ip);
    return reply.send(result);
  });

  app.get('/admin/config/history', { preHandler: [adminAudit] }, async (request, reply) => {
    const { key } = request.query as any;
    return reply.send(await adminConfig.getConfigHistory(key as string));
  });

  app.post('/admin/maintenance', {
    preHandler: [adminAudit],
    schema: {
      body: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { enabled, message } = request.body as any;
    const adminId = request.user.userId;

    await adminConfig.toggleMaintenance(enabled, message || null, adminId);
    await writeAdminAuditLog('maintenance_toggle', null, adminId, { enabled, message }, request.ip);
    return reply.send({ maintenanceMode: enabled, message: message || null });
  });

  // ============================================================
  // SECTION I: ADMIN AUDIT LOG
  // ============================================================

  app.get('/admin/audit-log', { preHandler: [adminAudit] }, async (request, reply) => {
    const { action, page = '1', limit = '50' } = request.query as any;
    return reply.send(await adminAuditSvc.getAuditLog(
      action as string,
      safeParseInt(page, 1),
      safeParseInt(limit, 50)
    ));
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
    return reply.send(await monitoring.getHealthHistory(safeParseInt(hours, 24)));
  });
}
