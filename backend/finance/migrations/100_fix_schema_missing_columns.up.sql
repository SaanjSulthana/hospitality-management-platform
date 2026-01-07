-- Migration 100: Fix Schema - Add Missing Columns (Force Run)
-- This migration ensures all required columns exist in expenses and revenues tables
-- It repeats logic from migration 15 which may have been skipped due to version collisions
-- Safe to run multiple times (uses IF NOT EXISTS checks)

-- ============================================================================
-- EXPENSES TABLE - Add Missing Columns
-- ============================================================================

DO $$
BEGIN
    -- Only proceed if expenses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        
        -- Add description column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'description') THEN
            ALTER TABLE expenses ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column to expenses table';
        END IF;
        
        -- Add created_by_user_id column (if missing)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'created_by_user_id') THEN
            ALTER TABLE expenses ADD COLUMN created_by_user_id BIGINT;
            RAISE NOTICE 'Added created_by_user_id column to expenses table';
        END IF;
        
        -- Add currency column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'currency') THEN
            ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT 'INR';
            RAISE NOTICE 'Added currency column to expenses table';
        END IF;
        
        -- Add receipt_url column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'receipt_url') THEN
            ALTER TABLE expenses ADD COLUMN receipt_url TEXT;
            RAISE NOTICE 'Added receipt_url column to expenses table';
        END IF;
        
        -- Add receipt_file_id column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'receipt_file_id') THEN
            ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
            RAISE NOTICE 'Added receipt_file_id column to expenses table';
        END IF;
        
        -- Add status column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'status') THEN
            ALTER TABLE expenses ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
            RAISE NOTICE 'Added status column to expenses table';
        END IF;
        
        -- Add approved_by_user_id column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'approved_by_user_id') THEN
            ALTER TABLE expenses ADD COLUMN approved_by_user_id INTEGER;
            RAISE NOTICE 'Added approved_by_user_id column to expenses table';
        END IF;
        
        -- Add approved_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'approved_at') THEN
            ALTER TABLE expenses ADD COLUMN approved_at TIMESTAMP;
            RAISE NOTICE 'Added approved_at column to expenses table';
        END IF;
        
        -- Add payment_mode column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'payment_mode') THEN
            ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(50) DEFAULT 'cash';
            RAISE NOTICE 'Added payment_mode column to expenses table';
        END IF;
        
        -- Add bank_reference column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'bank_reference') THEN
            ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(100);
            RAISE NOTICE 'Added bank_reference column to expenses table';
        END IF;
        
    ELSE
        RAISE NOTICE 'Expenses table does not exist - skipping column additions';
    END IF;
END $$;

-- ============================================================================
-- REVENUES TABLE - Add Missing Columns
-- ============================================================================

DO $$
BEGIN
    -- Only proceed if revenues table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
        
        -- Add description column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'description') THEN
            ALTER TABLE revenues ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column to revenues table';
        END IF;
        
        -- Add created_by_user_id column (if missing)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'created_by_user_id') THEN
            ALTER TABLE revenues ADD COLUMN created_by_user_id BIGINT;
            RAISE NOTICE 'Added created_by_user_id column to revenues table';
        END IF;
        
        -- Add source column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'source') THEN
            ALTER TABLE revenues ADD COLUMN source TEXT;
            RAISE NOTICE 'Added source column to revenues table';
        END IF;
        
        -- Add currency column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'currency') THEN
            ALTER TABLE revenues ADD COLUMN currency TEXT DEFAULT 'INR';
            RAISE NOTICE 'Added currency column to revenues table';
        END IF;
        
        -- Add receipt_url column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'receipt_url') THEN
            ALTER TABLE revenues ADD COLUMN receipt_url TEXT;
            RAISE NOTICE 'Added receipt_url column to revenues table';
        END IF;
        
        -- Add receipt_file_id column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'receipt_file_id') THEN
            ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;
            RAISE NOTICE 'Added receipt_file_id column to revenues table';
        END IF;
        
        -- Add status column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'status') THEN
            ALTER TABLE revenues ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
            RAISE NOTICE 'Added status column to revenues table';
        END IF;
        
        -- Add approved_by_user_id column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'approved_by_user_id') THEN
            ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
            RAISE NOTICE 'Added approved_by_user_id column to revenues table';
        END IF;
        
        -- Add approved_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'approved_at') THEN
            ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
            RAISE NOTICE 'Added approved_at column to revenues table';
        END IF;
        
        -- Add payment_mode column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'payment_mode') THEN
            ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(50) DEFAULT 'cash';
            RAISE NOTICE 'Added payment_mode column to revenues table';
        END IF;
        
        -- Add bank_reference column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'bank_reference') THEN
            ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(100);
            RAISE NOTICE 'Added bank_reference column to revenues table';
        END IF;
        
    ELSE
        RAISE NOTICE 'Revenues table does not exist - skipping column additions';
    END IF;
END $$;

-- ============================================================================
-- Update existing records with default values where needed
-- ============================================================================

-- Update expenses with default status if NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'status') THEN
        UPDATE expenses SET status = 'pending' WHERE status IS NULL;
        RAISE NOTICE 'Updated expenses with default status';
    END IF;
END $$;

-- Update revenues with default status if NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'status') THEN
        UPDATE revenues SET status = 'pending' WHERE status IS NULL;
        RAISE NOTICE 'Updated revenues with default status';
    END IF;
END $$;
