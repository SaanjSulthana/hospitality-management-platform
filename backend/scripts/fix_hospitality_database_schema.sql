-- =========================================================================
-- FIX HOSPITALITY DATABASE SCHEMA
-- Run this in: Encore Cloud > Database > hospitality > SQL Console
-- This fixes the main revenues and expenses tables (not partitioned)
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Fix revenues table
-- -------------------------------------------------------------------------

-- Add created_by_user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE revenues ADD COLUMN created_by_user_id BIGINT;
    RAISE NOTICE 'Added created_by_user_id to revenues';
  END IF;
END $$;

-- Add source if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'source') THEN
    ALTER TABLE revenues ADD COLUMN source TEXT;
    RAISE NOTICE 'Added source to revenues';
  END IF;
END $$;

-- Add currency if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'currency') THEN
    ALTER TABLE revenues ADD COLUMN currency TEXT DEFAULT 'INR';
    RAISE NOTICE 'Added currency to revenues';
  END IF;
END $$;

-- Add description if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'description') THEN
    ALTER TABLE revenues ADD COLUMN description TEXT;
    RAISE NOTICE 'Added description to revenues';
  END IF;
END $$;

-- Add receipt_url if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'receipt_url') THEN
    ALTER TABLE revenues ADD COLUMN receipt_url TEXT;
    RAISE NOTICE 'Added receipt_url to revenues';
  END IF;
END $$;

-- Add meta_json if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'meta_json') THEN
    ALTER TABLE revenues ADD COLUMN meta_json JSONB;
    RAISE NOTICE 'Added meta_json to revenues';
  END IF;
END $$;

-- Add receipt_file_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'receipt_file_id') THEN
    ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;
    RAISE NOTICE 'Added receipt_file_id to revenues';
  END IF;
END $$;

-- Add status if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'status') THEN
    ALTER TABLE revenues ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
    RAISE NOTICE 'Added status to revenues';
  END IF;
END $$;

-- Add approved_by_user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'approved_by_user_id') THEN
    ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
    RAISE NOTICE 'Added approved_by_user_id to revenues';
  END IF;
END $$;

-- Add approved_at if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'approved_at') THEN
    ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
    RAISE NOTICE 'Added approved_at to revenues';
  END IF;
END $$;

-- Add payment_mode if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'payment_mode') THEN
    ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(50) DEFAULT 'cash';
    RAISE NOTICE 'Added payment_mode to revenues';
  END IF;
END $$;

-- Add bank_reference if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'bank_reference') THEN
    ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(100);
    RAISE NOTICE 'Added bank_reference to revenues';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 2. Fix expenses table
-- -------------------------------------------------------------------------

-- Add created_by_user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE expenses ADD COLUMN created_by_user_id BIGINT;
    RAISE NOTICE 'Added created_by_user_id to expenses';
  END IF;
END $$;

-- Add currency if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'currency') THEN
    ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT 'INR';
    RAISE NOTICE 'Added currency to expenses';
  END IF;
END $$;

-- Add description if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'description') THEN
    ALTER TABLE expenses ADD COLUMN description TEXT;
    RAISE NOTICE 'Added description to expenses';
  END IF;
END $$;

-- Add receipt_url if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'receipt_url') THEN
    ALTER TABLE expenses ADD COLUMN receipt_url TEXT;
    RAISE NOTICE 'Added receipt_url to expenses';
  END IF;
END $$;

-- Add receipt_file_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'receipt_file_id') THEN
    ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
    RAISE NOTICE 'Added receipt_file_id to expenses';
  END IF;
END $$;

-- Add status if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'status') THEN
    ALTER TABLE expenses ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
    RAISE NOTICE 'Added status to expenses';
  END IF;
END $$;

-- Add approved_by_user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'approved_by_user_id') THEN
    ALTER TABLE expenses ADD COLUMN approved_by_user_id INTEGER;
    RAISE NOTICE 'Added approved_by_user_id to expenses';
  END IF;
END $$;

-- Add approved_at if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'approved_at') THEN
    ALTER TABLE expenses ADD COLUMN approved_at TIMESTAMP;
    RAISE NOTICE 'Added approved_at to expenses';
  END IF;
END $$;

-- Add payment_mode if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'payment_mode') THEN
    ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(50) DEFAULT 'cash';
    RAISE NOTICE 'Added payment_mode to expenses';
  END IF;
END $$;

-- Add bank_reference if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'bank_reference') THEN
    ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(100);
    RAISE NOTICE 'Added bank_reference to expenses';
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 3. Create indexes for performance
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_revenues_created_by ON revenues(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by_user_id);

-- =========================================================================
-- DONE! Now test the API endpoints
-- =========================================================================

