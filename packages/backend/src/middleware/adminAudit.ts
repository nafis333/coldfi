import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool';
import { logger } from '../services/logger';

export async function writeAdminAuditLog(
  action: string,
  targetId: string | null,
  actorId: string,
  metadata: Record<string, any> = {},
  ipAddress?: string,
  targetType?: string
): Promise<void> {
  const tt = targetType || (targetId ? 'user' : 'system');
  await query(
    `INSERT INTO admin_audit_log (action, actor_id, target_type, target_id, metadata, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [action, actorId, tt, targetId, JSON.stringify(metadata), ipAddress || null]
  );
}

export async function adminAudit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user?.userId;
  const action = `${request.method} ${request.routeOptions?.url || request.url}`;
  const ipAddress = request.ip;

  const segments = (request.url || '').split('/').filter(Boolean);
  const targetType = segments[0] || null;
  const targetId = segments[1] || null;

  try {
    await query(
      `INSERT INTO admin_audit_log (action, actor_id, target_type, target_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        action,
        userId,
        targetType,
        targetId,
        JSON.stringify({ method: request.method, url: request.url }),
        ipAddress,
      ]
    );
  } catch (err) {
    logger.error('Admin audit log error', { module: 'admin-audit', error: (err as Error).message });
  }
}
