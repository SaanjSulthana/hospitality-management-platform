-- =========================================================================
-- Migration 14: Add missing columns to partitioned tables (SAFE VERSION)
-- Purpose: Align partitioned tables with main hospitality database schema
-- Created: December 2025
-- =========================================================================

-- This migration safely adds columns that may be missing
-- It uses IF NOT EXISTS to prevent errors on columns that already exist

-- -------------------------------------------------------------------------
-- 1. Add missing columns to revenues_partitioned (if table exists)
-- -------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues_partitioned') THEN
    -- Add source column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'source') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN source TEXT;
    END IF;
    
    -- Add currency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'currency') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;
    
    -- Add receipt_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'receipt_url') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN receipt_url TEXT;
    END IF;
    
    -- Add meta_json column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'meta_json') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN meta_json JSONB;
    END IF;
    
    -- Add receipt_file_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'receipt_file_id') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN receipt_file_id INTEGER;
    END IF;
    
    -- Add bank_reference column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'bank_reference') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN bank_reference VARCHAR(100);
    END IF;
    
    -- Add created_by_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN created_by_user_id INTEGER;
    END IF;
    
    -- Add approved_by_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'approved_by_user_id') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN approved_by_user_id INTEGER;
    END IF;
    
    -- Add approved_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'approved_at') THEN
      ALTER TABLE revenues_partitioned ADD COLUMN approved_at TIMESTAMP;
    END IF;
    
    RAISE NOTICE 'revenues_partitioned columns updated';
  ELSE
    RAISE NOTICE 'revenues_partitioned table does not exist, skipping';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 2. Add missing columns to expenses_partitioned (if table exists)
-- -------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses_partitioned') THEN
    -- Add currency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'currency') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;
    
    -- Add receipt_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'receipt_url') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN receipt_url TEXT;
    END IF;
    
    -- Add receipt_file_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'receipt_file_id') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN receipt_file_id INTEGER;
    END IF;
    
    -- Add bank_reference column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'bank_reference') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN bank_reference VARCHAR(100);
    END IF;
    
    -- Add created_by_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN created_by_user_id INTEGER;
    END IF;
    
    -- Add approved_by_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'approved_by_user_id') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN approved_by_user_id INTEGER;
    END IF;
    
    -- Add approved_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'approved_at') THEN
      ALTER TABLE expenses_partitioned ADD COLUMN approved_at TIMESTAMP;
    END IF;
    
    RAISE NOTICE 'expenses_partitioned columns updated';
  ELSE
    RAISE NOTICE 'expenses_partitioned table does not exist, skipping';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 3. Create indexes safely (only if tables and columns exist)
-- -------------------------------------------------------------------------

DO $$
BEGIN
  -- Index on revenues_partitioned.source
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'source') THEN
    CREATE INDEX IF NOT EXISTS idx_revenues_part_source ON revenues_partitioned(source);
  END IF;
  
  -- Index on revenues_partitioned.created_by_user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'created_by_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_revenues_part_created_by ON revenues_partitioned(created_by_user_id);
  END IF;
  
  -- Index on expenses_partitioned.created_by_user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'created_by_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_expenses_part_created_by ON expenses_partitioned(created_by_user_id);
  END IF;
  
  -- Index on expenses_partitioned.expense_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'expense_date') THEN
    CREATE INDEX IF NOT EXISTS idx_expenses_part_expense_date ON expenses_partitioned(expense_date);
  END IF;
END $$;

-- =========================================================================
-- MIGRATION COMPLETE
-- This migration safely adds missing columns to partitioned tables
-- All operations are idempotent and safe to run multiple times
-- =========================================================================
