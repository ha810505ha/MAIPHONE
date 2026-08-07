-- Correct the first approved test account email without changing its balance,
-- provider secret mapping, or usage history.
UPDATE mali_test_accounts
SET email = 'a878799@gmail.com', updated_at = datetime('now')
WHERE user_id = 'pending-email:a878799'
   OR lower(email) = 'a8787999@gmail.com';
