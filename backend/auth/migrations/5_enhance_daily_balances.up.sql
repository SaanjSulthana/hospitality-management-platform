-- Migration 4: Add enhanced daily balances fields

-- Add new columns to daily_cash_balances table
ALTER TABLE daily_cash_balances ADD COLUMN IF NOT EXISTS is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_cash_balances ADD COLUMN IF NOT EXISTS calculated_closing_balance_cents INTEGER DEFAULT 0;
ALTER TABLE daily_cash_balances ADD COLUMN IF NOT EXISTS balance_discrepancy_cents INTEGER DEFAULT 0;

-- Create index for previous day balance lookups
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date);
