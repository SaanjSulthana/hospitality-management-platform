-- Rollback migration 12: Remove enhancement fields from daily_cash_balances table

-- Remove the index
DROP INDEX IF EXISTS idx_daily_cash_balances_prev_day;

-- Remove the enhancement columns
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS is_opening_balance_auto_calculated;
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS calculated_closing_balance_cents;
ALTER TABLE daily_cash_balances DROP COLUMN IF EXISTS balance_discrepancy_cents;
