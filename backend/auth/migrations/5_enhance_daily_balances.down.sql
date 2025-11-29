-- Rollback migration 5: Remove enhanced daily balances fields

DO $$
BEGIN
    -- Check if daily_cash_balances table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_cash_balances') THEN
        -- Drop the index first
        DROP INDEX IF EXISTS idx_daily_cash_balances_prev_day;

        -- Remove the added columns
        ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS balance_discrepancy_cents;
        ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS calculated_closing_balance_cents;
        ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS is_opening_balance_auto_calculated;
    ELSE
        RAISE NOTICE 'Table daily_cash_balances does not exist, skipping rollback';
    END IF;
END $$;
