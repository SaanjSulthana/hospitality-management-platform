-- =========================================================================
-- COMPREHENSIVE STAGING FIX: Add all missing columns
-- Run in Encore Cloud Console for BOTH databases
-- =========================================================================

-- =========================================================================
-- PART 1: Fix hospitality database (main tables)
-- Run this in: Encore Cloud > Database > hospitality > SQL Console
-- =========================================================================

-- 1.1 Fix revenues table
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS meta_json JSONB;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- 1.2 Fix expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- 1.3 Create indexes
CREATE INDEX IF NOT EXISTS idx_revenues_created_by ON revenues(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by_user_id);


-- =========================================================================
-- PART 2: Fix finance database (partitioned tables)
-- Run this in: Encore Cloud > Database > finance > SQL Console  
-- =========================================================================

-- 2.1 Fix revenues_partitioned
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS meta_json JSONB;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- 2.2 Fix expenses_partitioned
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- 2.3 Create indexes on partitioned tables
CREATE INDEX IF NOT EXISTS idx_revenues_part_created_by ON revenues_partitioned(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_revenues_part_source ON revenues_partitioned(source);
CREATE INDEX IF NOT EXISTS idx_expenses_part_created_by ON expenses_partitioned(created_by_user_id);

