import { query } from '../db/pool';
import { emitToUser } from '../plugins/websocket';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  groupId?: string;
  expenseId?: string;
  settlementId?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, group_id, expense_id, settlement_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id`,
    [input.userId, input.type, input.title, input.body || '', input.groupId || null, input.expenseId || null, input.settlementId || null]
  );

  const id = result.rows[0]!.id;

  emitToUser(input.userId, 'notification', {
    id,
    type: input.type,
    title: input.title,
    body: input.body || '',
    groupId: input.groupId || null,
    expenseId: input.expenseId || null,
    settlementId: input.settlementId || null,
    isRead: false,
    timestamp: new Date().toISOString(),
  });

  return { id };
}

export async function createNotificationForMultipleUsers(
  recipientIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<void> {
  if (recipientIds.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const userId of recipientIds) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, NOW())`);
    values.push(userId, input.type, input.title, input.body || '', input.groupId || null, input.expenseId || null, input.settlementId || null);
  }

  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, group_id, expense_id, settlement_id, created_at)
     VALUES ${placeholders.join(', ')}
     RETURNING id, user_id`,
    values
  );

  for (const row of result.rows) {
    emitToUser(row.user_id, 'notification', {
      id: row.id,
      type: input.type,
      title: input.title,
      body: input.body || '',
      groupId: input.groupId || null,
      expenseId: input.expenseId || null,
      settlementId: input.settlementId || null,
      isRead: false,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function deleteNotification(id: string, userId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}