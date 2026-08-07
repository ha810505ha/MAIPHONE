-- Per-account, one-time hosted text-model test credits.
-- Keys stay in Cloudflare Secrets; the browser can only consume an enabled account's balance.

CREATE TABLE IF NOT EXISTS mali_test_accounts (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  granted_points INTEGER NOT NULL DEFAULT 0 CHECK (granted_points >= 0),
  used_points INTEGER NOT NULL DEFAULT 0 CHECK (used_points >= 0 AND used_points <= granted_points),
  connection_test_count INTEGER NOT NULL DEFAULT 0 CHECK (connection_test_count >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  expires_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mali_test_accounts_enabled
  ON mali_test_accounts (enabled, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS mali_test_accounts_email
  ON mali_test_accounts (lower(email))
  WHERE email IS NOT NULL;

-- These rows are email-based allowlist entries until the corresponding Supabase
-- user IDs are known. Keep the initial balance at zero; assign points manually.
INSERT INTO mali_test_accounts (user_id, email, granted_points, enabled, note)
VALUES
  ('pending-email:a8787999', 'a8787999@gmail.com', 0, 1, 'Email allowlist; assign points manually'),
  ('pending-email:rikkakihana', 'rikkakihana@gmail.com', 0, 1, 'Email allowlist; assign points manually')
ON CONFLICT(user_id) DO UPDATE SET
  email = excluded.email,
  enabled = excluded.enabled,
  note = excluded.note,
  updated_at = datetime('now');

-- Keep the existing request ledger as the single source of truth for usage.
-- These columns intentionally contain metadata only; prompts and generated content are never stored.
ALTER TABLE ai_usage_requests ADD COLUMN mode TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_usage_requests ADD COLUMN request_type TEXT NOT NULL DEFAULT 'generation';
ALTER TABLE ai_usage_requests ADD COLUMN model TEXT;
ALTER TABLE ai_usage_requests ADD COLUMN input_chars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN output_chars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN estimated_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN points_charged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN points_refunded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN latency_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_requests ADD COLUMN generation_id TEXT;

ALTER TABLE ai_provider_attempts ADD COLUMN model TEXT;
ALTER TABLE ai_provider_attempts ADD COLUMN input_chars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_provider_attempts ADD COLUMN output_chars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_provider_attempts ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_provider_attempts ADD COLUMN latency_ms INTEGER NOT NULL DEFAULT 0;
