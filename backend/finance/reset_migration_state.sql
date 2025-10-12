-- Reset Finance Database Migration State
-- This script clears the migration state and prepares for a fresh migration run

-- Drop all finance-related tables in correct order (to handle foreign key constraints)
DROP TABLE IF EXISTS revenue_deletion_requests CASCADE;
DROP TABLE IF EXISTS expense_deletion_requests CASCADE;
DROP TABLE IF EXISTS daily_cash_balances CASCADE;
DROP TABLE IF EXISTS daily_approvals CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS revenues CASCADE;

-- Clear the migration tracking table for finance database
DELETE FROM schema_migrations WHERE version IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12');

-- Verify the cleanup
SELECT 'Finance database reset complete. Ready for fresh migration.' as status;