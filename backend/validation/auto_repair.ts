import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "../finance/db";
import { distributedCache } from "../cache/distributed_cache_manager";
import { validateDataConsistencyV1 } from "./data_consistency_validator";

// Shared handler for auto-repairing data consistency issues
async function autoRepairDataConsistencyHandler(req: { propertyId?: number; startDate?: string; endDate?: string; dryRun?: boolean }): Promise<{ repaired: number; errors: string[] }> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN")(authData);

  const { propertyId, startDate, endDate, dryRun = false } = req;
  let repaired = 0;
  const errors: string[] = [];

  // Get inconsistencies
  const validation = await validateDataConsistencyV1({ propertyId, startDate, endDate });
  
  for (const issue of validation.results) {
    try {
      if (!dryRun) {
        // Clear database cache if no transactions
        if (!issue.hasTransactions && issue.hasCachedBalance) {
          await financeDB.exec`
            DELETE FROM daily_cash_balances 
            WHERE org_id = ${authData.orgId} 
              AND property_id = ${issue.propertyId} 
              AND balance_date = ${issue.date}
          `;
        }

        // Clear Redis cache if no transactions
        if (!issue.hasTransactions && issue.hasRedisCache) {
          await distributedCache.invalidateDailyReport(authData.orgId, issue.propertyId, issue.date);
          await distributedCache.invalidateBalance(authData.orgId, issue.propertyId, issue.date);
        }
      }
      
      repaired++;
    } catch (error) {
      errors.push(`Failed to repair ${issue.propertyId}/${issue.date}: ${error.message}`);
    }
  }

  return { repaired, errors };
}

// LEGACY: Auto-repairs data consistency issues (keep for backward compatibility)
export const autoRepairDataConsistency = api<
  { propertyId?: number; startDate?: string; endDate?: string; dryRun?: boolean },
  { repaired: number; errors: string[] }
>(
  { auth: true, expose: true, method: "POST", path: "/validation/auto-repair" },
  autoRepairDataConsistencyHandler
);

// V1: Auto-repairs data consistency issues
export const autoRepairDataConsistencyV1 = api<
  { propertyId?: number; startDate?: string; endDate?: string; dryRun?: boolean },
  { repaired: number; errors: string[] }
>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/validation/auto-repair" },
  autoRepairDataConsistencyHandler
);
