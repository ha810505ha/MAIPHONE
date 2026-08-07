-- Hosted Mali model usage is tracked separately from user documents.
-- Limits are reserved atomically in D1 before an upstream Gemini call is made.

CREATE TABLE IF NOT EXISTS ai_usage_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  quota_day TEXT NOT NULL,
  feature TEXT NOT NULL,
  player_limit INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed')),
  provider_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS ai_usage_requests_player_day
  ON ai_usage_requests (user_id, quota_day, status);

CREATE TABLE IF NOT EXISTS ai_provider_attempts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES ai_usage_requests(id),
  provider_id TEXT NOT NULL,
  quota_day TEXT NOT NULL,
  provider_limit INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS ai_provider_attempts_provider_day
  ON ai_provider_attempts (provider_id, quota_day);

CREATE TRIGGER IF NOT EXISTS ai_usage_requests_player_limit
BEFORE INSERT ON ai_usage_requests
WHEN (
  SELECT COUNT(*) FROM ai_usage_requests
  WHERE user_id = NEW.user_id
    AND quota_day = NEW.quota_day
    AND status IN ('reserved', 'succeeded')
) >= NEW.player_limit
BEGIN
  SELECT RAISE(ABORT, 'PLAYER_DAILY_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS ai_provider_attempts_daily_limit
BEFORE INSERT ON ai_provider_attempts
WHEN (
  SELECT COUNT(*) FROM ai_provider_attempts
  WHERE provider_id = NEW.provider_id
    AND quota_day = NEW.quota_day
) >= NEW.provider_limit
BEGIN
  SELECT RAISE(ABORT, 'PROVIDER_DAILY_LIMIT');
END;
