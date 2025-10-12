-- Add timestamp and geolocation fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT,
ADD COLUMN IF NOT EXISTS last_login_location_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en-US';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_users_login_count ON users(login_count);
