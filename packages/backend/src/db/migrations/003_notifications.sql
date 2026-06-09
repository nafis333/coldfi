-- Migration 003: Notification tables
-- Depends on: 019 (users table must exist)

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions_web (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint        TEXT        NOT NULL,
    auth            TEXT        NOT NULL,
    p256dh          TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
    ON push_subscriptions_web (user_id, endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON push_subscriptions_web (user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    push_enabled                BOOLEAN     NOT NULL DEFAULT true,

    expense_created             BOOLEAN     NOT NULL DEFAULT true,
    expense_updated             BOOLEAN     NOT NULL DEFAULT true,
    expense_deleted             BOOLEAN     NOT NULL DEFAULT true,
    settlement_created          BOOLEAN     NOT NULL DEFAULT true,
    settlement_confirmed        BOOLEAN     NOT NULL DEFAULT true,
    settlement_rejected         BOOLEAN     NOT NULL DEFAULT true,
    member_joined               BOOLEAN     NOT NULL DEFAULT true,
    member_left                 BOOLEAN     NOT NULL DEFAULT true,
    balance_adjusted            BOOLEAN     NOT NULL DEFAULT true,
    reminders                   BOOLEAN     NOT NULL DEFAULT true,

    quiet_hours_start           TIME,
    quiet_hours_end             TIME,
    quiet_hours_enabled         BOOLEAN     NOT NULL DEFAULT false,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_preferences (user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
