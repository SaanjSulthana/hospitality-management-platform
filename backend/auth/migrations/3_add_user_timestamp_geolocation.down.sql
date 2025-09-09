-- Remove timestamp and geolocation fields from users table
ALTER TABLE users 
DROP COLUMN IF EXISTS last_activity_at,
DROP COLUMN IF EXISTS login_count,
DROP COLUMN IF EXISTS last_login_ip,
DROP COLUMN IF EXISTS last_login_user_agent,
DROP COLUMN IF EXISTS last_login_location_json,
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS locale;

-- Drop indexes
DROP INDEX IF EXISTS idx_users_last_activity;
DROP INDEX IF EXISTS idx_users_login_count;
