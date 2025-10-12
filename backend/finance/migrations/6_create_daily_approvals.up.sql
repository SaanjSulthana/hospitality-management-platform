-- Create table to track daily approvals for managers (only if dependencies exist)
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_approvals') THEN
        
        CREATE TABLE daily_approvals (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL,
            manager_user_id INTEGER NOT NULL,
            approval_date DATE NOT NULL,
            approved_by_admin_id INTEGER NOT NULL,
            approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
            notes TEXT,
            
            CONSTRAINT fk_daily_approvals_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
            CONSTRAINT fk_daily_approvals_manager_user_id FOREIGN KEY (manager_user_id) REFERENCES users(id),
            CONSTRAINT fk_daily_approvals_approved_by_admin_id FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
            
            -- Ensure one approval per manager per day
            UNIQUE(org_id, manager_user_id, approval_date)
        );
        
        -- Create indexes for efficient lookups
        CREATE INDEX IF NOT EXISTS idx_daily_approvals_manager_date ON daily_approvals(org_id, manager_user_id, approval_date);
        CREATE INDEX IF NOT EXISTS idx_daily_approvals_date ON daily_approvals(org_id, approval_date);
    END IF;
END $$;
