-- Create notifications table if it doesn't exist (only if dependencies exist)
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        
        CREATE TABLE notifications (
            id BIGSERIAL PRIMARY KEY,
            org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            payload_json JSONB DEFAULT '{}',
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create indexes for efficient lookups
        CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
    END IF;
END $$;
