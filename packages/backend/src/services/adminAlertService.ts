import { query } from '../db/pool';

export async function getAlertRules(): Promise<any[]> {
  const rules = await query('SELECT * FROM alert_rules ORDER BY name');
  return rules.rows;
}

export async function createAlertRule(rule: any, adminId: string): Promise<any> {
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
  return created;
}

export async function updateAlertRule(id: string, updates: any): Promise<any | null> {
  const { rows: [updated] } = await query(
    `UPDATE alert_rules SET name=$1, metric=$2, condition=$3, threshold=$4, window_minutes=$5, enabled=$6, channels=$7, webhook_url=$8, cooldown_minutes=$9
     WHERE id=$10 RETURNING *`,
    [
      updates.name, updates.metric, updates.condition, updates.threshold,
      updates.windowMinutes, updates.enabled, updates.channels,
      updates.webhookUrl, updates.cooldownMinutes, id,
    ]
  );
  return updated || null;
}

export async function deleteAlertRule(id: string): Promise<any | null> {
  const { rows: [deleted] } = await query('DELETE FROM alert_rules WHERE id = $1 RETURNING *', [id]);
  return deleted || null;
}

export async function getAlertHistory(
  page: number,
  limit: number,
  acknowledged?: string
): Promise<{ alerts: any[]; pagination: { page: number; limit: number; total: number } }> {
  const offset = (page - 1) * limit;

  let sql = 'SELECT ah.*, ar.name as rule_name FROM alert_history ah LEFT JOIN alert_rules ar ON ah.rule_id = ar.id';
  const params: any[] = [];

  if (acknowledged === 'false') {
    sql += ' WHERE ah.acknowledged = FALSE';
  }

  sql += ' ORDER BY ah.created_at DESC LIMIT $1 OFFSET $2';
  params.push(limit, offset);

  const [rowsResult, countResult] = await Promise.all([
    query(sql, params),
    query<{ count: number }>(
      'SELECT COUNT(*) as count FROM alert_history' + (acknowledged === 'false' ? ' WHERE acknowledged = FALSE' : '')
    ),
  ]);

  return {
    alerts: rowsResult.rows,
    pagination: { page, limit, total: Number(countResult.rows[0]?.count || 0) },
  };
}

export async function acknowledgeAlert(id: string, adminId: string): Promise<void> {
  await query(
    'UPDATE alert_history SET acknowledged = TRUE, acknowledged_by = $1 WHERE id = $2',
    [adminId, id]
  );
}
