-- Enhance daily cash balances table for automatic balance calculation (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_cash_balances') THEN
        
        -- Add fields to track balance calculation method (only if they don't exist)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_cash_balances' AND column_name = 'is_opening_balance_auto_calculated') THEN
            ALTER TABLE daily_cash_balances ADD COLUMN is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_cash_balances' AND column_name = 'calculated_closing_balance_cents') THEN
            ALTER TABLE daily_cash_balances ADD COLUMN calculated_closing_balance_cents INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_cash_balances' AND column_name = 'balance_discrepancy_cents') THEN
            ALTER TABLE daily_cash_balances ADD COLUMN balance_discrepancy_cents INTEGER DEFAULT 0;
        END IF;
        
        -- Add index for efficient previous day lookups (only if it doesn't exist)
        CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date DESC);
        
        -- Add comments to explain the new fields
        COMMENT ON COLUMN daily_cash_balances.is_opening_balance_auto_calculated IS 'True if opening balance was automatically calculated from previous day, false if manually set';
        COMMENT ON COLUMN daily_cash_balances.calculated_closing_balance_cents IS 'The closing balance as calculated from opening + cash revenue - cash expenses';
        COMMENT ON COLUMN daily_cash_balances.balance_discrepancy_cents IS 'Difference between manual closing balance and calculated closing balance';
    END IF;
END $$;
