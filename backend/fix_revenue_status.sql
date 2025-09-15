-- Add status column to revenues table if it doesn't exist
DO $$ 
BEGIN
    -- Check if status column exists in revenues table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        -- Add status column
        ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
        ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
        ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
        
        -- Add foreign key constraint for approved_by_user_id
        ALTER TABLE revenues ADD CONSTRAINT fk_revenues_approved_by_user_id 
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
        
        -- Keep existing revenues as 'pending' status (they need approval)
        -- UPDATE revenues SET status = 'approved' WHERE status = 'pending'; -- REMOVED: All transactions need approval
        
        RAISE NOTICE 'Added status column to revenues table';
    ELSE
        RAISE NOTICE 'Status column already exists in revenues table';
    END IF;
END $$;

