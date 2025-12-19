-- =========================================================================
-- STAGING FIX: Add missing columns to partitioned tables
-- Run this in Encore Cloud > Database > finance > SQL Console
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. FIX revenues_partitioned
-- -------------------------------------------------------------------------

ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS meta_json JSONB;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- -------------------------------------------------------------------------
-- 2. FIX expenses_partitioned  
-- -------------------------------------------------------------------------

ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

-- -------------------------------------------------------------------------
-- 3. Create indexes for performance
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_revenues_part_created_by ON revenues_partitioned(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_part_source ON revenues_partitioned(source);
CREATE INDEX IF NOT EXISTS idx_expenses_part_created_by ON expenses_partitioned(created_by_user_id);

-- =========================================================================
-- DONE! Now test the API
-- =========================================================================

