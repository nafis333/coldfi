import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebPushService } from '../services/webPush';
import { query, pool } from '../db/pool';

const ENDPOINT_URL_REGEX = /^https:\/\/.+$/;
const BASE64_REGEX = /^[A-Za-z0-9+/_-]+={0,2}$/;

const VALID_PREFERENCE_KEYS = [
  'push_enabled',
  'expense_created',
  'expense_updated',
  'expense_deleted',
  'settlement_created',
  'settlement_confirmed',
  'settlement_rejected',
  'member_joined',
  'member_left',
  'balance_adjusted',
  'reminders',
  'quiet_hours_start',
  'quiet_hours_end',
  'quiet_hours_enabled',
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateTimeFormat(time: string): boolean {
  return TIME_REGEX.test(time);
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  const pushService = new WebPushService(pool);

  app.post('/push/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { endpoint, auth, p256dh } = request.body as any;

    if (!endpoint || !auth || !p256dh) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'endpoint, auth, and p256dh are required',
      });
    }

    if (!ENDPOINT_URL_REGEX.test(endpoint)) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'endpoint must be a valid HTTPS URL',
      });
    }

    if (!BASE64_REGEX.test(auth) || !BASE64_REGEX.test(p256dh)) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'auth and p256dh must be valid base64-encoded strings',
      });
    }

    try {
      const id = await pushService.subscribe(userId, { endpoint, auth, p256dh });
      return reply.status(201).send({
        success: true,
        id,
        message: 'Web Push subscription registered successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to register push subscription');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to register push subscription',
      });
    }
  });

  app.delete('/push/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { endpoint } = request.body as any;

    if (!endpoint || typeof endpoint !== 'string' || endpoint.trim().length === 0) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'endpoint is required',
      });
    }

    try {
      const removed = await pushService.unsubscribe(userId, endpoint.trim());
      if (!removed) {
        return reply.status(404).send({
          error: 'ERR_NOT_FOUND',
          message: 'Subscription not found',
        });
      }
      return reply.status(200).send({
        success: true,
        message: 'Web Push subscription removed successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to remove push subscription');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to remove push subscription',
      });
    }
  });

  // In-app notification feed

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      const result = await query(
        `SELECT id, type, title, body, is_read, group_id, expense_id, settlement_id, created_at,
                COUNT(*) FILTER (WHERE is_read = false) OVER() as unread_count
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      );

      const unreadCount = result.rows.length > 0 ? parseInt(result.rows[0]!.unread_count, 10) : 0;

      const notifications = result.rows.map((row: any) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        isRead: row.is_read,
        groupId: row.group_id,
        expenseId: row.expense_id,
        settlementId: row.settlement_id,
        timestamp: row.created_at,
      }));

      return reply.send({
        notifications,
        unreadCount,
      });
    } catch (error) {
      request.log.error(error, 'Failed to fetch notifications');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to fetch notifications',
      });
    }
  });

  app.patch('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    try {
      await query(
        `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error, 'Failed to mark notification as read');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to mark notification as read',
      });
    }
  });

  app.post('/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      await query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error, 'Failed to mark all notifications as read');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to mark all notifications as read',
      });
    }
  });

  app.get('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      const preferences = await pushService.getPreferences(userId);
      if (!preferences) {
        return reply.status(200).send({
          success: true,
          preferences: {
            push_enabled: true,
            expense_created: true,
            expense_updated: true,
            expense_deleted: true,
            settlement_created: true,
            settlement_confirmed: true,
            settlement_rejected: true,
            member_joined: true,
            member_left: true,
            balance_adjusted: true,
            reminders: true,
            quiet_hours_start: null,
            quiet_hours_end: null,
            quiet_hours_enabled: false,
          },
          isDefault: true,
        });
      }
      return reply.status(200).send({
        success: true,
        preferences,
        isDefault: false,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get notification preferences');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to retrieve notification preferences',
      });
    }
  });

  app.put('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const body = request.body as any;

    if (!body || Object.keys(body).length === 0) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'At least one preference field is required',
      });
    }

    const invalidKeys = Object.keys(body).filter(
      (key) => !VALID_PREFERENCE_KEYS.includes(key)
    );
    if (invalidKeys.length > 0) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: `Invalid preference keys: ${invalidKeys.join(', ')}`,
      });
    }

    if (body.quiet_hours_start && !validateTimeFormat(body.quiet_hours_start)) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'quiet_hours_start must be in HH:MM format (e.g., 22:00)',
      });
    }
    if (body.quiet_hours_end && !validateTimeFormat(body.quiet_hours_end)) {
      return reply.status(400).send({
        error: 'ERR_VALIDATION',
        message: 'quiet_hours_end must be in HH:MM format (e.g., 07:00)',
      });
    }

    try {
      const preferences = await pushService.updatePreferences(userId, body);
      return reply.status(200).send({
        success: true,
        preferences,
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to update notification preferences');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to update notification preferences',
      });
    }
  });
}
