BEGIN;

-- Fix reminders table to match Plan 02 spec (notification reminders)
-- Old table had recurring-bill schema, was unused by any code

DROP TABLE IF EXISTS reminders CASCADE;

CREATE TABLE reminders (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id      UUID REFERENCES groups(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'bill_due', 'settlement_pending', 'budget_alert',
    'approval_needed', 'large_expense_pending', 'member_joined'
  )),
  message       TEXT NOT NULL,
  payload       JSONB DEFAULT '{}',
  due_at        TIMESTAMPTZ NOT NULL,
  sent_push     BOOLEAN DEFAULT FALSE,
  sent_email    BOOLEAN DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_pending ON reminders(due_at) WHERE sent_push = FALSE;
CREATE INDEX idx_reminders_type ON reminders(type, due_at);

COMMIT;
