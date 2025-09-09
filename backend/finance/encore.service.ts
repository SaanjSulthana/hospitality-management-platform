import { Service } from "encore.dev/service";

export default new Service("finance");

// Export the migration endpoint
export { runMigration } from "./run_migration";
export { checkSchema } from "./check_schema";
export { ensureNotificationsTable } from "./ensure_notifications_table";
export { ensureDailyApprovalsTable } from "./ensure_daily_approvals_table";
export { setupDatabase } from "./setup_database";
export { quickSetup } from "./quick_setup";
export { testDatabase } from "./test_database";