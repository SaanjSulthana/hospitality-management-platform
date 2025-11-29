-- Finance service migration 1: Ensure revenues table structure
-- This migration runs after auth service creates the base tables

-- Only proceed if revenues table exists (created by auth service)
DO $$
BEGIN
    -- Check if revenues table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
        -- Add any missing indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_revenues_org_property ON revenues(org_id, property_id);
        CREATE INDEX IF NOT EXISTS idx_revenues_occurred_at ON revenues(occurred_at);
        CREATE INDEX IF NOT EXISTS idx_revenues_created_by ON revenues(created_by_user_id);
        
        -- Add table comment
        COMMENT ON TABLE revenues IS 'Financial revenue transactions for properties';
        
        RAISE NOTICE 'Finance migration 1: Revenues table structure verified and indexes created';
    ELSE
        RAISE NOTICE 'Finance migration 1: Revenues table not found - auth service migrations must run first';
    END IF;
END $$;
