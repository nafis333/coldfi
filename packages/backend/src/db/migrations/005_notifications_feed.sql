-- Migration 005: In-app notification feed
-- Depends on: users table

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT        NOT NULL,
    title           TEXT        NOT NULL,
    body            TEXT        NOT NULL DEFAULT '',
    is_read         BOOLEAN     NOT NULL DEFAULT false,
    group_id        UUID,
    expense_id      UUID,
    settlement_id   UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id, created_at DESC);

COMMIT;
