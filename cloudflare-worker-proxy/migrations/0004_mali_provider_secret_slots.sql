-- Map each approved test account to a Cloudflare secret name.
-- Only the name is stored in D1; the OpenRouter key remains a Worker secret.
ALTER TABLE mali_test_accounts ADD COLUMN openrouter_secret_name TEXT;

-- Keep the existing uploaded key with the first approved account.
UPDATE mali_test_accounts
SET openrouter_secret_name = 'OPENROUTER_API_KEY', updated_at = datetime('now')
WHERE lower(email) = 'a8787999@gmail.com';

-- The second approved account will use OPENROUTER_API_KEY_RIKKAKIHANA.
UPDATE mali_test_accounts
SET openrouter_secret_name = 'OPENROUTER_API_KEY_RIKKAKIHANA', updated_at = datetime('now')
WHERE lower(email) = 'rikkakihana@gmail.com';
