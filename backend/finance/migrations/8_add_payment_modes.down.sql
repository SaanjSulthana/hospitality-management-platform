-- Rollback Migration 8: Remove Payment Modes and Daily Cash Balance Tracking

-- Drop the daily financial summary view
DROP VIEW IF EXISTS daily_financial_summary;

-- Drop indexes
DROP INDEX IF EXISTS idx_daily_cash_balances_org_date;
DROP INDEX IF EXISTS idx_daily_cash_balances_property_date;
DROP INDEX IF EXISTS idx_revenues_payment_mode;
DROP INDEX IF EXISTS idx_expenses_payment_mode;

-- Drop the daily cash balances table
DROP TABLE IF EXISTS daily_cash_balances;

-- Remove payment mode and bank reference columns from expenses
ALTER TABLE expenses DROP COLUMN IF EXISTS bank_reference;
ALTER TABLE expenses DROP COLUMN IF EXISTS payment_mode;

-- Remove payment mode and bank reference columns from revenues
ALTER TABLE revenues DROP COLUMN IF EXISTS bank_reference;
ALTER TABLE revenues DROP COLUMN IF EXISTS payment_mode;
