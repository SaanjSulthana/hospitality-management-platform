-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_update_expense_deletion_requests_updated_at ON expense_deletion_requests;
DROP TRIGGER IF EXISTS trigger_update_revenue_deletion_requests_updated_at ON revenue_deletion_requests;

-- Drop functions
DROP FUNCTION IF EXISTS update_expense_deletion_requests_updated_at();
DROP FUNCTION IF EXISTS update_revenue_deletion_requests_updated_at();

-- Drop tables
DROP TABLE IF EXISTS expense_deletion_requests;
DROP TABLE IF EXISTS revenue_deletion_requests;
