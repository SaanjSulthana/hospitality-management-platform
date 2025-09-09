-- Enhance daily cash balances table for automatic balance calculation
-- Migration 1: Add fields to track balance calculation method and validation

-- Add fields to track balance calculation method
ALTER TABLE daily_cash_balances ADD COLUMN is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_cash_balances ADD COLUMN calculated_closing_balance_cents INTEGER;
ALTER TABLE daily_cash_balances ADD COLUMN balance_discrepancy_cents INTEGER DEFAULT 0;

-- Add index for efficient previous day lookups
CREATE INDEX idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date DESC);

-- Add comment to explain the new fields
COMMENT ON COLUMN daily_cash_balances.is_opening_balance_auto_calculated IS 'True if opening balance was automatically calculated from previous day, false if manually set';
COMMENT ON COLUMN daily_cash_balances.calculated_closing_balance_cents IS 'The closing balance as calculated from opening + cash revenue - cash expenses';
COMMENT ON COLUMN daily_cash_balances.balance_discrepancy_cents IS 'Difference between manual closing balance and calculated closing balance';
