import { Service } from "encore.dev/service";

export default new Service("reports");

// Export all report endpoints
export { getDailyReport } from "./daily_reports";
export { getDailyReports } from "./daily_reports";
export { updateDailyCashBalanceSmart } from "./daily_reports";
export { updateDailyCashBalance } from "./daily_reports";
export { calculateOpeningBalanceEndpoint } from "./daily_reports";
export { exportDailyReportPDF } from "./daily_reports";
export { exportDailyReportExcel } from "./daily_reports";
export { getMonthlyYearlyReport } from "./monthly_yearly_reports";
export { getMonthlySummary } from "./monthly_yearly_reports";
export { getYearlySummary } from "./monthly_yearly_reports";
export { generatePDF } from "./generate_pdf";

// Export the migration and schema check endpoints
export { runMigration } from "./run_migration";
export { runCompleteMigration } from "./run_complete_migration";
export { checkSchema } from "./check_schema";
export { debugDailyReport } from "./debug_daily_report";
export { debugAllTransactions } from "./debug_all_transactions";
export { pollRealtimeUpdates } from "./realtime_sse";
export { getCacheMetrics, clearCache } from "./cache_metrics";