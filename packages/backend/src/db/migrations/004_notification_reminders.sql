-- Migration 004: Notification reminders table
-- Separate from the recurring-bill reminders table in 001_init.sql

BEGIN;

CREATE TABLE IF NOT EXISTS notification_reminders (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id      UUID        NOT NULL,
    type          TEXT        NOT NULL,
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    scheduled_at  TIMESTAMPTZ NOT NULL,
    sent_at       TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    metadata      JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_reminders_pending
    ON notification_reminders (status, scheduled_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_reminders_user
    ON notification_reminders (user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_notification_reminders_updated_at
    BEFORE UPDATE ON notification_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
