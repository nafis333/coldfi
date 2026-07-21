CREATE TABLE IF NOT EXISTS sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_group ON sync_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced ON sync_logs(last_synced_at DESC);
