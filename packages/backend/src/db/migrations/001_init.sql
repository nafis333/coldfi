-- 001_init.sql
-- Users and authentication tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  auth_key_hash VARCHAR(255) NOT NULL,

  -- Crypto
  personal_salt VARCHAR(255) NOT NULL,
  personal_data_enc BYTEA NOT NULL,
  personal_vc JSONB NOT NULL DEFAULT '[]',
  recovery_key_enc BYTEA,
  two_factor_secret VARCHAR(255),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Profile
  display_name VARCHAR(100),
  avatar_url TEXT,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

  -- Security
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created_at ON users (created_at);

-- ============================================================
-- REFRESH TOKENS TABLE
-- ============================================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_info JSONB,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for refresh_tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- ============================================================
-- AUTO-UPDATE TIMESTAMP FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users table
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROUPS TABLE
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  group_salt VARCHAR(255) NOT NULL,
  passphrase_verifier VARCHAR(255) NOT NULL,
  group_data_enc BYTEA NOT NULL,
  group_vc JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  avatar_url TEXT,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for groups
CREATE INDEX idx_groups_created_by ON groups (created_by);
CREATE INDEX idx_groups_is_active ON groups (is_active);

-- Apply updated_at trigger to groups
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROUP MEMBERS TABLE
-- ============================================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  member_index INTEGER NOT NULL,

  -- Display
  display_name VARCHAR(100),
  avatar_color VARCHAR(7),

  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE (group_id, user_id),
  UNIQUE (group_id, member_index),
  CHECK (role IN ('admin', 'member', 'viewer'))
);

-- Indexes for group_members
CREATE INDEX idx_group_members_group_id ON group_members (group_id);
CREATE INDEX idx_group_members_user_id ON group_members (user_id);
CREATE INDEX idx_group_members_role ON group_members (group_id, role);

-- ============================================================
-- REMINDERS TABLE
-- ============================================================
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly'))
);

CREATE INDEX idx_reminders_user_id ON reminders (user_id);
CREATE INDEX idx_reminders_group_id ON reminders (group_id);
CREATE INDEX idx_reminders_next_due ON reminders (next_due_date) WHERE is_active = TRUE;

CREATE TRIGGER set_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RECEIPTS TABLE
-- ============================================================
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  thumbnail_path TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_expense_id ON receipts (expense_id);
CREATE INDEX idx_receipts_group_id ON receipts (group_id);

-- ============================================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions (user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions (user_id) WHERE is_active = TRUE;

CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SYSTEM CONFIG TABLE
-- ============================================================
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: Default system configuration
-- ============================================================
INSERT INTO system_config (key, value, description) VALUES
  ('app.version', '"1.0.0"', 'Application version'),
  ('app.maintenance_mode', 'false', 'Whether the app is in maintenance mode'),
  ('app.registration_enabled', 'true', 'Whether new user registration is allowed'),
  ('security.max_login_attempts', '5', 'Maximum failed login attempts before lockout'),
  ('security.lockout_minutes', '15', 'Account lockout duration in minutes'),
  ('security.password_min_length', '8', 'Minimum password length'),
  ('security.session_expiry_hours', '24', 'Session token expiry in hours'),
  ('features.groups_max_members', '50', 'Maximum members per group'),
  ('features.receipt_max_size_mb', '10', 'Maximum receipt file size in MB'),
  ('features.export_enabled', 'true', 'Whether data export is enabled')
ON CONFLICT (key) DO NOTHING;
