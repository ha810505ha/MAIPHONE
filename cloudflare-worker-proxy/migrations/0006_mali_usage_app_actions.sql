-- Add safe, content-free identifiers so each hosted request can be matched to
-- the app and action that triggered it. Prompts and generated content remain
-- outside the usage ledger.
ALTER TABLE ai_usage_requests ADD COLUMN app_id TEXT NOT NULL DEFAULT 'other';
ALTER TABLE ai_usage_requests ADD COLUMN action_id TEXT NOT NULL DEFAULT 'generate';

CREATE INDEX IF NOT EXISTS ai_usage_requests_app_action_time
  ON ai_usage_requests (app_id, action_id, created_at);
