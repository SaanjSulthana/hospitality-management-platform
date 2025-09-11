-- Rollback migration 4: Drop daily_cash_balances table

-- Drop indexes first
DROP INDEX IF EXISTS idx_daily_cash_balances_property_date;
DROP INDEX IF EXISTS idx_daily_cash_balances_org_date;

-- Drop the table
DROP TABLE IF EXISTS daily_cash_balances;
