import { query } from '../db/pool';

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

export interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number };
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
