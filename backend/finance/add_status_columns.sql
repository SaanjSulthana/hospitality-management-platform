-- Add missing status columns to revenues and expenses tables
-- This script is idempotent - it won't fail if columns already exist

-- Add status column to revenues table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'status'
    ) THEN
        ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE 'Added status column to revenues table';
    ELSE
        RAISE NOTICE 'Status column already exists in revenues table';
    END IF;
END $$;

-- Add status column to expenses table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'status'
    ) THEN
        ALTER TABLE expenses ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE 'Added status column to expenses table';
    ELSE
        RAISE NOTICE 'Status column already exists in expenses table';
    END IF;
END $$;

-- Add other missing columns to revenues table
DO $$ 
BEGIN
    -- Add payment_mode column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'payment_mode'
    ) THEN
        ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(20) DEFAULT 'cash';
        RAISE NOTICE 'Added payment_mode column to revenues table';
    END IF;

    -- Add bank_reference column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'bank_reference'
    ) THEN
        ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255);
        RAISE NOTICE 'Added bank_reference column to revenues table';
    END IF;

    -- Add receipt_file_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'receipt_file_id'
    ) THEN
        ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;
        RAISE NOTICE 'Added receipt_file_id column to revenues table';
    END IF;

    -- Add approved_by_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'approved_by_user_id'
    ) THEN
        ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
        RAISE NOTICE 'Added approved_by_user_id column to revenues table';
    END IF;

    -- Add approved_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'revenues' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
        RAISE NOTICE 'Added approved_at column to revenues table';
    END IF;
END $$;

-- Add other missing columns to expenses table
DO $$ 
BEGIN
    -- Add payment_mode column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'payment_mode'
    ) THEN
        ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(20) DEFAULT 'cash';
        RAISE NOTICE 'Added payment_mode column to expenses table';
    END IF;

    -- Add bank_reference column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'bank_reference'
    ) THEN
        ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255);
        RAISE NOTICE 'Added bank_reference column to expenses table';
    END IF;

    -- Add receipt_file_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'receipt_file_id'
    ) THEN
        ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
        RAISE NOTICE 'Added receipt_file_id column to expenses table';
    END IF;

    -- Add approved_by_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'approved_by_user_id'
    ) THEN
        ALTER TABLE expenses ADD COLUMN approved_by_user_id INTEGER;
        RAISE NOTICE 'Added approved_by_user_id column to expenses table';
    END IF;

    -- Add approved_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE expenses ADD COLUMN approved_at TIMESTAMP;
        RAISE NOTICE 'Added approved_at column to expenses table';
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    -- Add foreign key constraint for revenues.approved_by_user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'revenues' AND constraint_name = 'revenues_approved_by_user_id_fkey'
    ) THEN
        ALTER TABLE revenues ADD CONSTRAINT revenues_approved_by_user_id_fkey 
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
        RAISE NOTICE 'Added foreign key constraint for revenues.approved_by_user_id';
    END IF;

    -- Add foreign key constraint for expenses.approved_by_user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'expenses' AND constraint_name = 'expenses_approved_by_user_id_fkey'
    ) THEN
        ALTER TABLE expenses ADD CONSTRAINT expenses_approved_by_user_id_fkey 
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
        RAISE NOTICE 'Added foreign key constraint for expenses.approved_by_user_id';
    END IF;
END $$;

-- Create indexes for better performance
DO $$ 
BEGIN
    -- Create index on revenues.status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'revenues' AND indexname = 'idx_revenues_status'
    ) THEN
        CREATE INDEX idx_revenues_status ON revenues(status);
        RAISE NOTICE 'Created index on revenues.status';
    END IF;

    -- Create index on expenses.status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'expenses' AND indexname = 'idx_expenses_status'
    ) THEN
        CREATE INDEX idx_expenses_status ON expenses(status);
        RAISE NOTICE 'Created index on expenses.status';
    END IF;

    -- Create index on revenues.approved_by_user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'revenues' AND indexname = 'idx_revenues_approved_by_user_id'
    ) THEN
        CREATE INDEX idx_revenues_approved_by_user_id ON revenues(approved_by_user_id);
        RAISE NOTICE 'Created index on revenues.approved_by_user_id';
    END IF;

    -- Create index on expenses.approved_by_user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'expenses' AND indexname = 'idx_expenses_approved_by_user_id'
    ) THEN
        CREATE INDEX idx_expenses_approved_by_user_id ON expenses(approved_by_user_id);
        RAISE NOTICE 'Created index on expenses.approved_by_user_id';
    END IF;
END $$;

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('revenues', 'expenses') 
    AND column_name IN ('status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at')
ORDER BY table_name, column_name;
