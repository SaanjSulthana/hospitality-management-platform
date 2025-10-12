-- Add receipt_file_id column to revenues table (if table and column don't exist)
DO $$
BEGIN
    -- Check if revenues table exists and column doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'receipt_file_id') THEN
        ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;
    END IF;
END $$;

-- Add receipt_file_id column to expenses table (if table and column don't exist)
DO $$
BEGIN
    -- Check if expenses table exists and column doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'receipt_file_id') THEN
        ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
    END IF;
END $$;