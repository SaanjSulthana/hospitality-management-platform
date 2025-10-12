-- Fix expense_date column to use TIMESTAMPTZ instead of DATE (only if expenses table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'expense_date' AND data_type = 'date') THEN
        
        -- First, add a new column with the correct type
        ALTER TABLE expenses ADD COLUMN expense_date_new TIMESTAMPTZ;
        
        -- Copy existing data, converting DATE to TIMESTAMPTZ (defaults to midnight)
        UPDATE expenses SET expense_date_new = expense_date::TIMESTAMPTZ;
        
        -- Make the new column NOT NULL
        ALTER TABLE expenses ALTER COLUMN expense_date_new SET NOT NULL;
        
        -- Drop the old column
        ALTER TABLE expenses DROP COLUMN expense_date;
        
        -- Rename the new column to the original name
        ALTER TABLE expenses RENAME COLUMN expense_date_new TO expense_date;
    END IF;
END $$;
