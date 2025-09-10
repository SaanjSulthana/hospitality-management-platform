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
export { grantDailyApproval } from "./grant_daily_approval";
export { checkNotifications } from "./check_notifications";

// Export the migration endpoint
export { runMigration } from "./run_migration";
export { checkSchema } from "./check_schema";
export { ensureNotificationsTable } from "./ensure_notifications_table";
export { ensureDailyApprovalsTable } from "./ensure_daily_approvals_table";
export { setupDatabase } from "./setup_database";
export { quickSetup } from "./quick_setup";
export { testDatabase } from "./test_database";