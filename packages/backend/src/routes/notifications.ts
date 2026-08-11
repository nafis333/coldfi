import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebPushService } from '../services/webPush';
import { query, pool } from '../db/pool';
import { createNotification, createNotificationForMultipleUsers, deleteNotification } from '../services/notificationService';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors';
import { createRateLimiter } from '../middleware/rateLimiter';

const notificationRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxAttempts: 30,
  keyPrefix: 'rl:notification',
  keyFn: (req: any) => req.user?.userId || req.ip || 'unknown',
});

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
  'budget_alert',
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

  app.post('/push/subscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['endpoint', 'auth', 'p256dh'],
        properties: {
          endpoint: { type: 'string' },
          auth: { type: 'string' },
          p256dh: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { endpoint, auth, p256dh } = request.body as any;

    if (!ENDPOINT_URL_REGEX.test(endpoint)) {
      throw new ValidationError('endpoint must be a valid HTTPS URL');
    }

    if (!BASE64_REGEX.test(auth) || !BASE64_REGEX.test(p256dh)) {
      throw new ValidationError('auth and p256dh must be valid base64-encoded strings');
    }

    const id = await pushService.subscribe(userId, { endpoint, auth, p256dh });
    return reply.status(201).send({
      success: true,
      id,
      message: 'Web Push subscription registered successfully',
    });
  });

  app.delete('/push/unsubscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { endpoint } = request.body as any;

    const removed = await pushService.unsubscribe(userId, endpoint.trim());
    if (!removed) {
      throw new NotFoundError('Subscription');
    }
    return reply.send({
      success: true,
      message: 'Web Push subscription removed successfully',
    });
  });

  app.post('/', {
    preHandler: [notificationRateLimiter],
    schema: {
      body: {
        type: 'object',
        required: ['type', 'title'],
        properties: {
          type: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          body: { type: 'string' },
          groupId: { type: 'string' },
          expenseId: { type: 'string' },
          settlementId: { type: 'string' },
          push: { type: 'boolean' },
          pushCategory: { type: 'string' },
          recipientIds: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 100,
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { type, title, body, groupId, expenseId, settlementId, recipientIds, push, pushCategory } = request.body as any;

      if (groupId) {
        const senderResult = await query(
          `SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [groupId, userId]
        );
        if (senderResult.rows.length === 0) {
          throw new ForbiddenError('You are not a member of this group');
        }
      }

      if (Array.isArray(recipientIds) && recipientIds.length > 0) {
        if (recipientIds.includes(userId)) {
          throw new ValidationError('Cannot send notification to yourself via recipientIds');
        }
        if (groupId) {
          const groupMemberResult = await query(
            `SELECT user_id FROM group_members WHERE group_id = $1 AND left_at IS NULL AND user_id = ANY($2)`,
            [groupId, recipientIds]
          );
          const validUserIds = new Set(groupMemberResult.rows.map((r: any) => r.user_id));
          for (const rid of recipientIds) {
            if (!validUserIds.has(rid)) {
              throw new ForbiddenError(`Cannot send notification to user ${rid}: not a member of group ${groupId}`);
            }
          }
        } else {
          const groupResult = await query(
            `SELECT DISTINCT gm2.user_id FROM group_members gm1
             JOIN group_members gm2 ON gm1.group_id = gm2.group_id AND gm2.left_at IS NULL
             WHERE gm1.user_id = $1 AND gm1.left_at IS NULL`,
            [userId]
          );
          const sharedUserIds = new Set(groupResult.rows.map((r: any) => r.user_id));
          for (const rid of recipientIds) {
            if (!sharedUserIds.has(rid)) {
              throw new ForbiddenError(`Cannot send notification to user ${rid}: no shared groups`);
            }
          }
        }
      await createNotificationForMultipleUsers(recipientIds, { type, title, body, groupId, expenseId, settlementId });
    } else {
      await createNotification({ userId, type, title, body, groupId, expenseId, settlementId });
      if (push === true) {
        // Self-notifications can also trigger a browser push (e.g. budget
        // threshold alerts). Failures must never break the notification itself.
        try {
          await pushService.sendWebPush({
            userId,
            title,
            body: body || title,
            data: { type },
            category: typeof pushCategory === 'string' ? pushCategory : 'budget_alert',
          });
        } catch (err) {
          request.log.error(err, 'Failed to send web push for notification');
        }
      }
    }
    return reply.status(201).send({ success: true });
  });

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const deleted = await deleteNotification(id, userId);
    if (!deleted) {
      throw new NotFoundError('Notification');
    }
    return reply.send({ success: true });
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

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
  });

  app.patch('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const result = await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Notification');
    }
    return reply.send({ success: true });
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

    const preferences = await pushService.getPreferences(userId);
    if (!preferences) {
      return reply.send({
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
          budget_alert: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          quiet_hours_enabled: false,
        },
        isDefault: true,
      });
    }
    return reply.send({
      success: true,
      preferences,
      isDefault: false,
    });
  });

  app.put('/preferences', {
    schema: {
      body: {
        type: 'object',
        minProperties: 1,
        properties: {
          push_enabled: { type: 'boolean' },
          expense_created: { type: 'boolean' },
          expense_updated: { type: 'boolean' },
          expense_deleted: { type: 'boolean' },
          settlement_created: { type: 'boolean' },
          settlement_confirmed: { type: 'boolean' },
          settlement_rejected: { type: 'boolean' },
          member_joined: { type: 'boolean' },
          member_left: { type: 'boolean' },
          balance_adjusted: { type: 'boolean' },
          reminders: { type: 'boolean' },
          budget_alert: { type: 'boolean' },
          quiet_hours_start: { type: 'string' },
          quiet_hours_end: { type: 'string' },
          quiet_hours_enabled: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const body = request.body as any;

    const invalidKeys = Object.keys(body).filter(
      (key) => !VALID_PREFERENCE_KEYS.includes(key)
    );
    if (invalidKeys.length > 0) {
      throw new ValidationError(`Invalid preference keys: ${invalidKeys.join(', ')}`);
    }

    if (body.quiet_hours_start && !validateTimeFormat(body.quiet_hours_start)) {
      throw new ValidationError('quiet_hours_start must be in HH:MM format (e.g., 22:00)');
    }
    if (body.quiet_hours_end && !validateTimeFormat(body.quiet_hours_end)) {
      throw new ValidationError('quiet_hours_end must be in HH:MM format (e.g., 07:00)');
    }

    const preferences = await pushService.updatePreferences(userId, body);
    return reply.send({
      success: true,
      preferences,
      message: 'Notification preferences updated successfully',
    });
  });
}
