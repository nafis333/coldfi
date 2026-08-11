-- Migration 020: budget alert notification preference
BEGIN;

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS budget_alert BOOLEAN NOT NULL DEFAULT true;

COMMIT;
