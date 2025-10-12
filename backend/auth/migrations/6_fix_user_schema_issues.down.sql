-- Rollback user schema fixes
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

DROP INDEX IF EXISTS idx_users_login_count;
DROP INDEX IF EXISTS idx_users_updated_at;

ALTER TABLE users 
DROP COLUMN IF EXISTS login_count,
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS locale,
DROP COLUMN IF EXISTS updated_at;
