-- 002_personal_data.sql
-- Personal data storage and recovery key columns

-- ============================================================
-- PERSONAL DATA TABLE (separate from users for sync management)
-- ============================================================
CREATE TABLE personal_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_blob TEXT NOT NULL,
  vector_clock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_personal_data_updated_at
  BEFORE UPDATE ON personal_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ADD RECOVERY KEY COLUMNS TO USERS
-- ============================================================
ALTER TABLE users
  ADD COLUMN encrypted_pek TEXT,
  ADD COLUMN recovery_key_hash VARCHAR(255);
