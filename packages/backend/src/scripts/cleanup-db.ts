import { query, closePool } from '../db/pool';

async function run() {
  console.log('Cleaning database...');

  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM user_activity_log');
  await query('DELETE FROM notifications');
  await query('DELETE FROM group_members');
  await query('DELETE FROM groups');
  await query('DELETE FROM receipts');
  await query('DELETE FROM push_subscriptions');
  await query('DELETE FROM push_subscriptions_web');
  await query('DELETE FROM user_restrictions');
  await query('DELETE FROM personal_data');
  await query('DELETE FROM group_sync');
  await query('DELETE FROM notification_preferences');
  await query('DELETE FROM notification_reminders');
  await query('DELETE FROM sync_logs');
  await query('DELETE FROM reminders');
  await query('DELETE FROM invite_codes');
  await query('DELETE FROM users');

  console.log('All user data deleted.');
  await closePool();
}

run().catch((e) => { console.error(e); process.exit(1); });
