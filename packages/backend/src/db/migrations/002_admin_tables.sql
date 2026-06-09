-- ============================================================
-- MIGRATION 002: Admin & Monitoring Tables
-- ============================================================

-- 2.1. API METRICS (per-endpoint counters, aggregated hourly)
CREATE TABLE api_metrics_hourly (
  id              BIGSERIAL PRIMARY KEY,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  status_group    TEXT NOT NULL,
  count           INT NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  max_duration_ms INT NOT NULL DEFAULT 0,
  hour_bucket     TIMESTAMPTZ NOT NULL,
  UNIQUE(endpoint, method, status_group, hour_bucket)
);

CREATE INDEX idx_api_metrics_hour ON api_metrics_hourly(hour_bucket DESC);

-- 2.2. SLOW QUERIES LOG
CREATE TABLE slow_queries (
  id              BIGSERIAL PRIMARY KEY,
  query_text      TEXT NOT NULL,
  duration_ms     INT NOT NULL,
  caller          TEXT,
  user_id         UUID REFERENCES users(id),
  stack_trace     TEXT,
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slow_queries_duration ON slow_queries(duration_ms DESC);
CREATE INDEX idx_slow_queries_time ON slow_queries(occurred_at DESC);

-- 2.3. SYSTEM LOGS (application logs)
CREATE TABLE system_logs (
  id              BIGSERIAL PRIMARY KEY,
  level           TEXT NOT NULL CHECK (level IN ('debug','info','warn','error','fatal')),
  module          TEXT NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  request_id      TEXT,
  user_id         UUID REFERENCES users(id),
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level, created_at DESC);
CREATE INDEX idx_system_logs_request ON system_logs(request_id);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);

-- 2.4. ERROR INSPECTOR (deduplicated errors for dashboard)
CREATE TABLE error_events (
  id                BIGSERIAL PRIMARY KEY,
  error_code        TEXT NOT NULL,
  error_message     TEXT NOT NULL,
  stack_hash        TEXT,
  module            TEXT NOT NULL,
  first_seen        TIMESTAMPTZ DEFAULT NOW(),
  last_seen         TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count  INT DEFAULT 1,
  affected_users    INT DEFAULT 0,
  sample_trace      TEXT,
  resolved          BOOLEAN DEFAULT FALSE,
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  UNIQUE(stack_hash)
);

CREATE INDEX idx_error_events_count ON error_events(occurrence_count DESC);
CREATE INDEX idx_error_events_last ON error_events(last_seen DESC);

-- 2.5. SUSPENDED/BANNED USERS
CREATE TABLE user_restrictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('suspended', 'banned', 'rate_limited')),
  reason        TEXT NOT NULL,
  admin_id      UUID REFERENCES users(id),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  lifted_at     TIMESTAMPTZ,
  UNIQUE(user_id, type, lifted_at)
);

CREATE INDEX idx_user_restrictions_active ON user_restrictions(user_id) WHERE lifted_at IS NULL;

-- 2.6. USER ACTIVITY LOG
CREATE TABLE user_activity_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user ON user_activity_log(user_id, created_at DESC);
CREATE INDEX idx_user_activity_ip ON user_activity_log(ip_address, created_at DESC);

-- 2.7. ALERTS CONFIG & HISTORY
CREATE TABLE alert_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  metric          TEXT NOT NULL,
  condition       TEXT NOT NULL,
  threshold       FLOAT NOT NULL,
  window_minutes  INT DEFAULT 5,
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  enabled         BOOLEAN DEFAULT TRUE,
  channels        TEXT[] DEFAULT '{panel}',
  webhook_url     TEXT,
  cooldown_minutes INT DEFAULT 30,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_history (
  id              BIGSERIAL PRIMARY KEY,
  rule_id         UUID REFERENCES alert_rules(id),
  rule_name       TEXT NOT NULL,
  metric          TEXT NOT NULL,
  actual_value    FLOAT NOT NULL,
  threshold       FLOAT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  message         TEXT NOT NULL,
  acknowledged    BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_history_time ON alert_history(created_at DESC);
CREATE INDEX idx_alert_history_unack ON alert_history(acknowledged, created_at DESC) WHERE acknowledged = FALSE;

-- 2.8. DB MONITORING SNAPSHOTS
CREATE TABLE db_stats_snapshots (
  id                      BIGSERIAL PRIMARY KEY,
  snapshot_at             TIMESTAMPTZ DEFAULT NOW(),
  total_connections       INT,
  active_connections      INT,
  waiting_connections     INT,
  total_table_size_mb     DECIMAL(10,2),
  index_size_mb           DECIMAL(10,2),
  dead_tuples_total       BIGINT,
  cache_hit_ratio         DECIMAL(5,4),
  longest_running_query_seconds INT
);

-- 2.9. CONFIG CHANGE HISTORY
CREATE TABLE config_change_log (
  id            BIGSERIAL PRIMARY KEY,
  config_key    TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  changed_by    TEXT NOT NULL,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_config_change_key ON config_change_log(config_key, created_at DESC);

-- 2.10. ADMIN AUDIT LOG
-- 001_init.sql previously created admin_audit_log with different column names
-- (admin_user_id, details, UUID id). This migration replaces that table.
DROP TABLE IF EXISTS admin_audit_log CASCADE;

CREATE TABLE admin_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  action        TEXT NOT NULL,
  actor_id      UUID REFERENCES users(id),
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  metadata      JSONB DEFAULT '{}',
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_id, created_at DESC);

-- ============================================================
-- Seed default alert rules
-- ============================================================
INSERT INTO alert_rules (name, metric, condition, threshold, window_minutes, channels, cooldown_minutes) VALUES
  ('High Error Rate', 'error_rate', '>', 5.0, 5, '{panel,email}', 15),
  ('Low Disk Space', 'disk_space', '<', 10.0, 10, '{panel,email}', 60),
  ('High Memory Usage', 'memory', '>', 90.0, 5, '{panel}', 30),
  ('Slow p99 Response', 'p99_latency', '>', 5000, 5, '{panel}', 30),
  ('Registration Spike', 'reg_rate', '>', 10.0, 60, '{panel}', 120),
  ('Queue Backpressure', 'queue_depth', '>', 1000, 5, '{panel}', 15),
  ('SSL Expiring Soon', 'ssl_expiry', '<', 14, 1440, '{panel,email}', 1440),
  ('DB Connections High', 'db_connections', '>', 80.0, 5, '{panel}', 30);
