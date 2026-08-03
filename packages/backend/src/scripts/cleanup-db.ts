import { transaction, closePool } from '../db/pool';

async function run() {
  console.log('Cleaning database...');

  await transaction(async (client) => {
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM user_activity_log');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM group_members');
    await client.query('DELETE FROM groups');
    await client.query('DELETE FROM receipts');
    await client.query('DELETE FROM push_subscriptions');
    await client.query('DELETE FROM push_subscriptions_web');
    await client.query('DELETE FROM user_restrictions');
    await client.query('DELETE FROM personal_data');
    await client.query('DELETE FROM group_sync');
    await client.query('DELETE FROM notification_preferences');
    await client.query('DELETE FROM notification_reminders');
    await client.query('DELETE FROM sync_logs');
    await client.query('DELETE FROM reminders');
    await client.query('DELETE FROM invite_codes');
    await client.query('DELETE FROM users');
  });

  console.log('All user data deleted.');
  await closePool();
}

run().catch((e) => { console.error(e); process.exit(1); });
