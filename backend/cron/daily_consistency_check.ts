import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { validateDataConsistency } from "../validation/data_consistency_validator";
import { autoRepairDataConsistency } from "../validation/auto_repair";

interface ConsistencyCheckResponse {
  success: boolean;
  message: string;
}

// Shared handler for daily consistency check
async function runDailyConsistencyCheckHandler(): Promise<ConsistencyCheckResponse> {
    console.log("[Cron] Starting daily consistency check");
    
    // Check last 7 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      // Run validation
      const validation = await validateDataConsistency({ startDate, endDate });
      
      if (validation.totalIssues > 0) {
        console.log(`[Cron] Found ${validation.totalIssues} consistency issues, auto-repairing...`);
        const repair = await autoRepairDataConsistency({ startDate, endDate, dryRun: false });
        console.log(`[Cron] Auto-repair completed: ${repair.repaired} issues fixed, ${repair.errors.length} errors`);
      } else {
        console.log("[Cron] No consistency issues found");
      }
      
      console.log("[Cron] Daily consistency check completed");
      return { success: true, message: "Daily consistency check completed" };
    } catch (error) {
      console.error("[Cron] Daily consistency check failed:", error);
      return { success: false, message: `Daily consistency check failed: ${error.message}` };
    }
}

// Daily consistency check API endpoint

// LEGACY: Runs daily consistency check (keep for backward compatibility)
export const runDailyConsistencyCheck = api<{}, ConsistencyCheckResponse>(
  { auth: false, expose: false, method: "POST", path: "/cron/daily-consistency-check" },
  runDailyConsistencyCheckHandler
);

// V1: Runs daily consistency check
export const runDailyConsistencyCheckV1 = api<{}, ConsistencyCheckResponse>(
  { auth: false, expose: false, method: "POST", path: "/v1/system/cron/daily-consistency-check" },
  runDailyConsistencyCheckHandler
);

export const dailyConsistencyCheck = new CronJob("daily-consistency-check", {
  title: "Daily Data Consistency Check",
  schedule: "0 2 * * *", // 2 AM every day
  endpoint: runDailyConsistencyCheck
});
