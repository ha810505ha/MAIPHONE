-- D1 is intentionally for platform metadata and small JSON documents.
-- Supabase Auth remains the identity authority; user_id is verified by the Worker.

CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, document_key)
);

CREATE INDEX IF NOT EXISTS user_documents_updated_at
  ON user_documents (user_id, updated_at DESC);
