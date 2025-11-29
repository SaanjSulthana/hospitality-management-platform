-- Finance service migration 2: Ensure expenses table structure
-- This migration runs after auth service creates the base tables

-- Only proceed if expenses table exists (created by auth service)
DO $$
BEGIN
    -- Check if expenses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        -- Add any missing indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_expenses_org_property ON expenses(org_id, property_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_occurred_at ON expenses(occurred_at);
        CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by_user_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
        
        -- Add table comment
        COMMENT ON TABLE expenses IS 'Financial expense transactions for properties';
        
        RAISE NOTICE 'Finance migration 2: Expenses table structure verified and indexes created';
    ELSE
        RAISE NOTICE 'Finance migration 2: Expenses table not found - auth service migrations must run first';
    END IF;
END $$;
