-- Update users table check constraint to remove SUPER_ADMIN role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'MANAGER'));

-- Add missing columns to users table if they don't exist
DO $$
BEGIN
    -- Add last_activity_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_activity_at') THEN
        ALTER TABLE users ADD COLUMN last_activity_at TIMESTAMPTZ;
    END IF;
    
    -- Add login_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'login_count') THEN
        ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add last_login_ip column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_ip') THEN
        ALTER TABLE users ADD COLUMN last_login_ip TEXT;
    END IF;
    
    -- Add last_login_user_agent column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_user_agent') THEN
        ALTER TABLE users ADD COLUMN last_login_user_agent TEXT;
    END IF;
    
    -- Add last_login_location_json column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_location_json') THEN
        ALTER TABLE users ADD COLUMN last_login_location_json JSONB;
    END IF;
    
    -- Add timezone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'timezone') THEN
        ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';
    END IF;
    
    -- Add locale column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locale') THEN
        ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'en-US';
    END IF;
END $$;
