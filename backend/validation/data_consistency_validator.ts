import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "../finance/db";
import { distributedCache } from "../cache/distributed_cache_manager";

interface ConsistencyCheckResult {
  propertyId: number;
  date: string;
  hasTransactions: boolean;
  hasCachedBalance: boolean;
  hasRedisCache: boolean;
  isConsistent: boolean;
  issues: string[];
}

// Shared handler for validating data consistency
async function validateDataConsistencyHandler(req: { propertyId?: number; startDate?: string; endDate?: string }): Promise<{ results: ConsistencyCheckResult[]; totalIssues: number }> {
  const authData = getAuthData();
  if (!authData) throw APIError.unauthenticated("Authentication required");
  requireRole("ADMIN")(authData);

  const { propertyId, startDate, endDate } = req;
  const results: ConsistencyCheckResult[] = [];

  // Get all properties if not specified
  const properties = propertyId 
    ? [propertyId] 
    : await getOrgProperties(authData.orgId);

  for (const propId of properties) {
    const dates = generateDateRange(startDate, endDate);
    
    for (const date of dates) {
      const check = await checkConsistency(authData.orgId, propId, date);
      if (!check.isConsistent) {
        results.push(check);
      }
    }
  }

  return {
    results,
    totalIssues: results.length
  };
}

// LEGACY: Validates data consistency across database and caches (keep for backward compatibility)
export const validateDataConsistency = api<
  { propertyId?: number; startDate?: string; endDate?: string },
  { results: ConsistencyCheckResult[]; totalIssues: number }
>(
  { auth: true, expose: true, method: "POST", path: "/validation/check-consistency" },
  validateDataConsistencyHandler
);

// V1: Validates data consistency across database and caches
export const validateDataConsistencyV1 = api<
  { propertyId?: number; startDate?: string; endDate?: string },
  { results: ConsistencyCheckResult[]; totalIssues: number }
>(
  { auth: true, expose: true, method: "POST", path: "/v1/system/validation/check-consistency" },
  validateDataConsistencyHandler
);

async function checkConsistency(orgId: number, propertyId: number, date: string): Promise<ConsistencyCheckResult> {
  // Check if transactions exist
  const transactions = await financeDB.queryAll`
    SELECT COUNT(*) as count FROM (
      SELECT id FROM revenues WHERE org_id = ${orgId} AND property_id = ${propertyId} 
        AND occurred_at::date = ${date}::date AND status = 'approved'
      UNION ALL
      SELECT id FROM expenses WHERE org_id = ${orgId} AND property_id = ${propertyId} 
        AND expense_date::date = ${date}::date AND status = 'approved'
    ) t
  `;
  const hasTransactions = parseInt(transactions[0].count) > 0;

  // Check database cache
  const dbCache = await financeDB.queryRow`
    SELECT COUNT(*) as count FROM daily_cash_balances 
    WHERE org_id = ${orgId} AND property_id = ${propertyId} AND balance_date = ${date}
  `;
  const hasCachedBalance = parseInt(dbCache.count) > 0;

  // Check Redis cache
  const redisCache = await distributedCache.getDailyReport(orgId, propertyId, date);
  const hasRedisCache = redisCache !== null;

  // Determine consistency
  const issues: string[] = [];
  let isConsistent = true;

  if (!hasTransactions && hasCachedBalance) {
    issues.push("Database cache exists without transactions");
    isConsistent = false;
  }

  if (!hasTransactions && hasRedisCache) {
    issues.push("Redis cache exists without transactions");
    isConsistent = false;
  }

  return {
    propertyId,
    date,
    hasTransactions,
    hasCachedBalance,
    hasRedisCache,
    isConsistent,
    issues
  };
}

async function getOrgProperties(orgId: number): Promise<number[]> {
  const properties = await financeDB.queryAll`
    SELECT id FROM properties WHERE org_id = ${orgId}
  `;
  return properties.map(p => p.id);
}

function generateDateRange(startDate?: string, endDate?: string): string[] {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  const dates: string[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}
