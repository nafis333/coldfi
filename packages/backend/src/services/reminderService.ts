import { Pool } from 'pg';
import { WebPushService } from './webPush';
import { logger } from './logger';

export interface Reminder {
  id: string;
  user_id: string;
  group_id: string;
  type: string;
  title: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  userId: string;
  groupId: string;
  type: string;
  title: string;
  body: string;
  scheduledAt: Date;
  metadata?: Record<string, unknown>;
}

export class ReminderService {
  constructor(
    private pool: Pool,
    private pushService: WebPushService
  ) {}

  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    const { userId, groupId, type, title, body, scheduledAt, metadata } = input;

    const result = await this.pool.query(
      `INSERT INTO notification_reminders (user_id, group_id, type, title, body, scheduled_at, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        userId,
        groupId,
        type,
        title,
        body,
        scheduledAt.toISOString(),
        JSON.stringify(metadata ?? {}),
      ]
    );

    return result.rows[0];
  }

  async getPendingReminders(limit: number = 100): Promise<Reminder[]> {
    const result = await this.pool.query(
      `SELECT * FROM notification_reminders
       WHERE status = 'pending' AND scheduled_at <= now()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async markSent(reminderId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notification_reminders
       SET status = 'sent', sent_at = now(), updated_at = now()
       WHERE id = $1`,
      [reminderId]
    );
  }

  async markFailed(reminderId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notification_reminders
       SET status = 'failed', updated_at = now()
       WHERE id = $1`,
      [reminderId]
    );
  }

  async processReminder(reminder: Reminder): Promise<boolean> {
    try {
      const sent = await this.pushService.sendWebPush({
        userId: reminder.user_id,
        title: reminder.title,
        body: reminder.body,
        data: {
          type: 'reminder',
          reminderId: reminder.id,
          groupId: reminder.group_id,
          reminderType: reminder.type,
          ...(reminder.metadata as Record<string, string>),
        },
        category: 'reminders',
      });

      if (sent > 0) {
        await this.markSent(reminder.id);
        return true;
      } else {
        await this.markFailed(reminder.id);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to process reminder ${reminder.id}`, { module: 'reminder', error: String(error) });
      await this.markFailed(reminder.id);
      return false;
    }
  }

  async createSettlementReminders(
    groupId: string,
    groupName: string,
    amount: number,
    currency: string,
    dueDate: Date,
    debtorUserIds: string[]
  ): Promise<Reminder[]> {
    const reminders: Reminder[] = [];

    for (const userId of debtorUserIds) {
      const reminder = await this.createReminder({
        userId,
        groupId,
        type: 'settlement_due',
        title: `Payment reminder: ${groupName}`,
        body: `You have a pending payment of ${currency} ${amount.toFixed(2)} due in ${groupName}. Please settle up!`,
        scheduledAt: dueDate,
        metadata: {
          groupName,
          amount,
          currency,
          dueDate: dueDate.toISOString(),
        },
      });
      reminders.push(reminder);
    }

    return reminders;
  }

  async getUserReminders(
    userId: string,
    options?: { status?: string; limit?: number }
  ): Promise<Reminder[]> {
    const conditions = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }

    const limit = options?.limit ?? 50;

    const result = await this.pool.query(
      `SELECT * FROM notification_reminders
       WHERE ${conditions.join(' AND ')}
       ORDER BY scheduled_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    return result.rows;
  }

  async cancelGroupReminders(groupId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE notification_reminders
       SET status = 'failed', updated_at = now()
       WHERE group_id = $1 AND status = 'pending'`,
      [groupId]
    );

    return result.rowCount ?? 0;
  }

  async cleanupOldReminders(days: number = 90): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM notification_reminders
       WHERE status IN ('sent', 'failed')
         AND updated_at < now() - make_interval(days => $1)`,
      [days]
    );

    return result.rowCount ?? 0;
  }
}
