-- Migration 15 Down: Remove columns added by fix_staging_schema
-- Note: This is a destructive operation - use with caution

-- Remove columns from expenses table (only if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        ALTER TABLE expenses DROP COLUMN IF EXISTS bank_reference;
        ALTER TABLE expenses DROP COLUMN IF EXISTS payment_mode;
        ALTER TABLE expenses DROP COLUMN IF EXISTS approved_at;
        ALTER TABLE expenses DROP COLUMN IF EXISTS approved_by_user_id;
        ALTER TABLE expenses DROP COLUMN IF EXISTS status;
        ALTER TABLE expenses DROP COLUMN IF EXISTS receipt_file_id;
        ALTER TABLE expenses DROP COLUMN IF EXISTS receipt_url;
        ALTER TABLE expenses DROP COLUMN IF EXISTS currency;
        ALTER TABLE expenses DROP COLUMN IF EXISTS description;
        -- Note: created_by_user_id might be required, so we don't drop it
    END IF;
END $$;

-- Remove columns from revenues table (only if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
        ALTER TABLE revenues DROP COLUMN IF EXISTS bank_reference;
        ALTER TABLE revenues DROP COLUMN IF EXISTS payment_mode;
        ALTER TABLE revenues DROP COLUMN IF EXISTS approved_at;
        ALTER TABLE revenues DROP COLUMN IF EXISTS approved_by_user_id;
        ALTER TABLE revenues DROP COLUMN IF EXISTS status;
        ALTER TABLE revenues DROP COLUMN IF EXISTS receipt_file_id;
        ALTER TABLE revenues DROP COLUMN IF EXISTS receipt_url;
        ALTER TABLE revenues DROP COLUMN IF EXISTS currency;
        ALTER TABLE revenues DROP COLUMN IF EXISTS source;
        ALTER TABLE revenues DROP COLUMN IF EXISTS description;
        -- Note: created_by_user_id might be required, so we don't drop it
    END IF;
END $$;

