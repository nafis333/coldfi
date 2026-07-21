import { query } from '../db/pool';
import { safeParseInt } from '../utils/parse';

export async function getAuditLog(
  action?: string,
  page: string | number = 1,
  limit: string | number = 50
): Promise<{
  logs: any[];
  pagination: { page: number; limit: number; total: number };
}> {
  const pageNum = safeParseInt(typeof page === 'string' ? page : String(page), 1);
  const limitNum = Math.min(safeParseInt(typeof limit === 'string' ? limit : String(limit), 50), 100);
  const offset = (pageNum - 1) * limitNum;

  let sql = 'SELECT * FROM admin_audit_log';
  const params: any[] = [];

  if (action) {
    sql += ' WHERE action = $1';
    params.push(action);
  }

  const paramIdx = params.length + 1;
  sql += ' ORDER BY created_at DESC LIMIT $' + paramIdx + ' OFFSET $' + (paramIdx + 1);
  params.push(limitNum, offset);

  const [rowsResult, countResult] = await Promise.all([
    query(sql, params),
    query<{ count: number }>(
      'SELECT COUNT(*) as count FROM admin_audit_log' + (action ? ' WHERE action = $1' : ''),
      action ? [action] : []
    ),
  ]);

  return {
    logs: rowsResult.rows,
    pagination: { page: pageNum, limit: limitNum, total: Number(countResult.rows[0]?.count || 0) },
  };
}
