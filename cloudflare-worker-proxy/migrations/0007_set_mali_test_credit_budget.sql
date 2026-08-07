-- Set the one-time test budget for the two approved accounts.
-- Preserve already-recorded usage so the budget remains a total allowance.
UPDATE mali_test_accounts
SET granted_points = 500,
    updated_at = datetime('now')
WHERE lower(email) IN ('a878799@gmail.com', 'rikkakihana@gmail.com')
  AND granted_points < 500;
