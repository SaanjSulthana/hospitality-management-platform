-- Comprehensive Finance Database Reset
-- This script completely resets the finance database state

-- 1. Drop all finance-related tables in dependency order
DROP TABLE IF EXISTS revenue_deletion_requests CASCADE;
DROP TABLE IF EXISTS expense_deletion_requests CASCADE;
DROP TABLE IF EXISTS daily_cash_balances CASCADE;
DROP TABLE IF EXISTS daily_approvals CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS revenues CASCADE;

-- 2. Clear ALL migration tracking for finance
DELETE FROM schema_migrations WHERE version IN (
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
);

-- 3. Reset migration tracking state
UPDATE schema_migrations SET dirty = false WHERE dirty = true;

-- 4. Verify cleanup
SELECT 'Finance database completely reset. All migrations will run from scratch.' as status;