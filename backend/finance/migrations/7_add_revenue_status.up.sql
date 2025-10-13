-- Add status and approval fields to revenues table to match expenses
DO $$
BEGIN
    -- Only proceed if revenues table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'status') THEN
            ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'approved_by_user_id') THEN
            ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'approved_at') THEN
            ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
        END IF;
    END IF;
END $$;

-- Add foreign key constraint for approved_by_user_id (if it doesn't exist)
DO $$
BEGIN
    -- Only proceed if revenues table exists and users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE table_name = 'revenues' AND constraint_name = 'fk_revenues_approved_by_user_id') THEN
        ALTER TABLE revenues ADD CONSTRAINT fk_revenues_approved_by_user_id FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
    END IF;
END $$;

-- Update existing revenues to 'pending' status (only if revenues table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
        UPDATE revenues SET status = 'pending' WHERE status IS NULL;
    END IF;
END $$;