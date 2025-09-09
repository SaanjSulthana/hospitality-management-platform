-- Rollback migration 1: Remove enhanced daily balances fields

-- Drop the index first
DROP INDEX IF EXISTS idx_daily_cash_balances_prev_day;

-- Remove the added columns
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS balance_discrepancy_cents;
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS calculated_closing_balance_cents;
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS is_opening_balance_auto_calculated;
