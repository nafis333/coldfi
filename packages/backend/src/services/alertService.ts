import { query } from '../db/pool';
import * as monitoring from './monitoringService';
import { logger } from './logger';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  window_minutes: number;
  severity: string;
  enabled: boolean;
  channels: string[];
  webhook_url: string | null;
  cooldown_minutes: number;
}

export async function evaluateAlertRules(): Promise<void> {
  const rulesResult = await query<AlertRule>(
    'SELECT * FROM alert_rules WHERE enabled = TRUE'
  );
  const rules = rulesResult.rows;

  for (const rule of rules) {
    try {
      const value = await getMetricValue(rule.metric);
      if (value === null) continue;

      const breached = compareValues(value, rule.condition, rule.threshold);
      if (!breached) continue;

      const inCooldown = await checkCooldown(rule.id, rule.cooldown_minutes);
      if (inCooldown) continue;

      const severity = getSeverity(rule, value);
      await createAlert(rule, value, severity);
    } catch (err) {
      logger.error(`Alert evaluation failed for rule ${rule.name}`, { module: 'alert', rule: rule.id, error: String(err) });
    }
  }
}

async function getMetricValue(metric: string): Promise<number | null> {
  switch (metric) {
    case 'error_rate': {
      const overview = await monitoring.getErrorRateOverview(1);
      const latest = overview.hourlyBreakdown[overview.hourlyBreakdown.length - 1];
      if (!latest || latest.totalCalls === 0) return null;
      return ((latest.error4xx + latest.error5xx) / latest.totalCalls) * 100;
    }
    case 'disk_space': {
      const fs = await import('fs/promises');
      try {
        const stat = await fs.statfs('/');
        const total = stat.blocks * stat.bsize;
        const free = stat.bfree * stat.bsize;
        return total > 0 ? ((total - free) / total) * 100 : null;
      } catch {
        logger.warn('disk_space metric unavailable — statfs failed', { module: 'alert' });
        return null;
      }
    }
    case 'memory': {
      const os = await import('os');
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      return ((totalMem - freeMem) / totalMem) * 100;
    }
    case 'p99_latency': {
      const endpoints = await monitoring.getEndpointMetrics(1);
      const maxP99 = Math.max(...endpoints.map(e => e.avgDuration), 0);
      return maxP99;
    }
    case 'reg_rate': {
      const rate = await monitoring.getRegistrationRate(1);
      return rate.reduce((sum, d) => sum + d.count, 0);
    }
    case 'queue_depth':
      logger.warn('queue_depth metric is not implemented — returning null', { module: 'alert' });
      return null;
    case 'ssl_expiry':
      logger.warn('ssl_expiry metric is not implemented — returning null', { module: 'alert' });
      return null;
    case 'db_connections': {
      const health = await monitoring.getDatabaseHealth();
      return health.totalConnections > 0
        ? (health.activeConnections / health.totalConnections) * 100
        : 0;
    }
    default:
      logger.warn(`Unknown alert metric: ${metric}`, { module: 'alert' });
      return null;
  }
}

function compareValues(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

function getSeverity(rule: AlertRule, actualValue: number): 'info' | 'warning' | 'critical' {
  const ratio = actualValue / rule.threshold;
  if (ratio >= 2.0) return 'critical';
  if (ratio >= 1.2) return 'warning';
  return 'info';
}

async function checkCooldown(ruleId: string, cooldownMinutes: number): Promise<boolean> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM alert_history
     WHERE rule_id = $1 AND created_at > NOW() - make_interval(mins => $2)`,
    [ruleId, cooldownMinutes]
  );
  return Number(result.rows[0]?.count || 0) > 0;
}

async function createAlert(rule: AlertRule, actualValue: number, severity: string): Promise<void> {
  await query(
    `INSERT INTO alert_history (rule_id, rule_name, metric, actual_value, threshold, severity, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      rule.id,
      rule.name,
      rule.metric,
      actualValue,
      rule.threshold,
      severity,
      `Alert: ${rule.name} — ${rule.metric} ${actualValue.toFixed(2)} (threshold: ${rule.threshold})`,
    ]
  );

  logger.warn(`Alert: ${severity.toUpperCase()}: ${rule.name} — ${rule.metric} = ${actualValue.toFixed(2)} (threshold: ${rule.threshold})`, { module: 'alert' });
}

export async function testAlertRule(ruleId: string): Promise<any> {
  const result = await query<AlertRule>('SELECT * FROM alert_rules WHERE id = $1', [ruleId]);
  if (result.rows.length === 0) {
    return { error: 'Rule not found' };
  }

  const rule = result.rows[0]!;
  const value = await getMetricValue(rule.metric);
  const breached = value !== null && compareValues(value, rule.condition, rule.threshold);

  return {
    ruleName: rule.name,
    metric: rule.metric,
    currentValue: value,
    threshold: rule.threshold,
    condition: rule.condition,
    breached,
    severity: value !== null ? getSeverity(rule, value) : null,
  };
}
