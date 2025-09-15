import { Service } from "encore.dev/service";

export default new Service("finance");

// Export main finance endpoints
export { addRevenue } from "./add_revenue";
export { addExpense } from "./add_expense";
export { listRevenues } from "./list_revenues";
export { listExpenses } from "./list_expenses";
export { updateRevenue } from "./update_revenue";
export { updateExpense } from "./update_expense";
export { deleteRevenue } from "./delete_revenue";
export { deleteExpense } from "./delete_expense";
export { approveRevenue } from "./approve_revenue";
export { approveExpense } from "./approve_expense";
export { approveRevenueById } from "./approve_revenue_by_id";
export { approveExpenseById } from "./approve_expense_by_id";
export { checkDailyApproval } from "./check_daily_approval";
// export { grantDailyApproval } from "./grant_daily_approval"; // TEMPORARILY DISABLED
export { checkNotifications } from "./check_notifications";

// Export the migration endpoint
export { runMigration } from "./run_migration";
export { checkSchema } from "./check_schema";
export { ensureNotificationsTable } from "./ensure_notifications_table";
export { ensureDailyApprovalsTable } from "./ensure_daily_approvals_table";
export { setupDatabase } from "./setup_database";
export { quickSetup } from "./quick_setup";
export { testDatabase } from "./test_database";
export { ensureSchema } from "./ensure_schema";
export { testSimple } from "./test_simple";
export { initDb } from "./init_db";
export { forceInitDb } from "./force_init_db";
export { checkDbStatus } from "./check_db_status";
export { simpleTest } from "./simple_test";
export { verySimpleTest } from "./very_simple_test";
export { getPendingApprovals } from "./pending_approvals";
export { testDbSchema } from "./test_db_schema";
export { testAddRevenue } from "./test_add_revenue";
export { testAddExpense } from "./test_add_expense";
export { testMinimalAdd } from "./test_minimal_add";
export { testDbTables } from "./test_db_tables";
export { testSimpleRevenue } from "./test_simple_revenue";
export { addRevenueMinimal } from "./add_revenue_minimal";
export { checkPaymentColumns } from "./check_payment_columns";
export { runPaymentMigration } from "./run_payment_migration";
export { checkDbSchemaDirect } from "./check_db_schema_direct";
export { getFinancialSummary } from "./financial_summary";
export { runMigrationApi } from "./run_migration_api";
export { runMigrationNoAuth } from "./run_migration_no_auth";
export { testPaymentMode } from "./test_payment_mode";
export { addReceiptFileIdColumns } from "./add_receipt_file_id_columns";

// Export daily approval management endpoints
export { getDailyApprovalStats } from "./daily_approval_manager";
export { bulkApproveTransactions } from "./daily_approval_manager";
export { getDailyApprovalSummary } from "./daily_approval_manager";
export { getTodayPendingTransactions } from "./daily_approval_manager";

// Export reset approval status endpoint
export { resetApprovalStatus } from "./reset_approval_status";