import { query, transaction } from '../db/pool';

export async function getConfig(): Promise<any[]> {
  const configs = await query('SELECT * FROM system_config ORDER BY key');
  return configs.rows;
}

export async function updateConfig(
  key: string,
  value: any,
  description: string | null,
  adminId: string,
  ipAddress: string
): Promise<{ key: string; value: any }> {
  const oldResult = await query('SELECT value FROM system_config WHERE key = $1', [key]);
  const oldValue = oldResult.rows[0]?.value ?? null;
  const storedValue = typeof value === 'string' ? value : JSON.stringify(value);

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO system_config (key, value, description, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, description = COALESCE($3, system_config.description), updated_by = $4, updated_at = NOW()`,
      [key, storedValue, description, adminId]
    );

    await client.query(
      `INSERT INTO config_change_log (config_key, old_value, new_value, changed_by, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [key, oldValue, storedValue, adminId, ipAddress]
    );
  });

  return { key, value };
}

export async function getConfigHistory(key?: string): Promise<any[]> {
  let sql = 'SELECT * FROM config_change_log';
  const params: any[] = [];
  if (key) {
    sql += ' WHERE config_key = $1';
    params.push(key);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const result = await query(sql, params);
  return result.rows;
}

export async function toggleMaintenance(
  enabled: boolean,
  message: string | null,
  adminId: string
): Promise<void> {
  const value = enabled ? 'true' : 'false';

  await query(
    `INSERT INTO system_config (key, value, description, updated_by, updated_at)
     VALUES ('app.maintenance_mode', $1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, description = COALESCE($2, system_config.description), updated_by = $3, updated_at = NOW()`,
    [value, message, adminId]
  );
}
