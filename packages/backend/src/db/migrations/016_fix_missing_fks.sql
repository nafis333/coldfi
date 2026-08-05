-- Migration: 016_fix_missing_fks
-- Adds missing FOREIGN KEY constraints and ON DELETE actions
-- discovered during security audit.

-- 1. receipts.expense_id → expenses(id) ON DELETE CASCADE
--    (if expenses table exists; skip silently if not — expenses live in the
--    encrypted personal/group blobs, so this table may not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_expense_id_fkey;
    ALTER TABLE receipts ADD CONSTRAINT receipts_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. notification_reminders.group_id → groups(id) ON DELETE CASCADE
ALTER TABLE notification_reminders DROP CONSTRAINT IF EXISTS notification_reminders_group_id_fkey;
ALTER TABLE notification_reminders ADD CONSTRAINT notification_reminders_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- 3. notifications.group_id → groups(id) ON DELETE CASCADE
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_group_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- 4. notifications.expense_id → expenses(id) ON DELETE SET NULL
--    (if expenses table exists; skip silently if not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_expense_id_fkey;
    ALTER TABLE notifications ADD CONSTRAINT notifications_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. notifications.settlement_id → settlements(id) ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlements') THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_settlement_id_fkey;
    ALTER TABLE notifications ADD CONSTRAINT notifications_settlement_id_fkey
      FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. group_sync.updated_by → users(id) ON DELETE CASCADE
ALTER TABLE group_sync DROP CONSTRAINT IF EXISTS group_sync_updated_by_fkey;
ALTER TABLE group_sync ADD CONSTRAINT group_sync_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE;

-- 7. slow_queries.user_id → users(id) ON DELETE SET NULL
ALTER TABLE slow_queries DROP CONSTRAINT IF EXISTS slow_queries_user_id_fkey;
ALTER TABLE slow_queries ADD CONSTRAINT slow_queries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 8. system_logs.user_id → users(id) ON DELETE SET NULL
ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_user_id_fkey;
ALTER TABLE system_logs ADD CONSTRAINT system_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 9. user_restrictions.admin_id → users(id) ON DELETE SET NULL
ALTER TABLE user_restrictions DROP CONSTRAINT IF EXISTS user_restrictions_admin_id_fkey;
ALTER TABLE user_restrictions ADD CONSTRAINT user_restrictions_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- 10. alert_history.rule_id → alert_rules(id) ON DELETE SET NULL
ALTER TABLE alert_history DROP CONSTRAINT IF EXISTS alert_history_rule_id_fkey;
ALTER TABLE alert_history ADD CONSTRAINT alert_history_rule_id_fkey
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL;

-- 11. admin_audit_log.actor_id → users(id) ON DELETE SET NULL
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_actor_id_fkey;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

-- 12. Add CHECK constraint so invite_codes.use_count never exceeds max_uses
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS chk_invite_use_count;
ALTER TABLE invite_codes ADD CONSTRAINT chk_invite_use_count
  CHECK (use_count >= 0 AND (max_uses = 0 OR use_count <= max_uses));
