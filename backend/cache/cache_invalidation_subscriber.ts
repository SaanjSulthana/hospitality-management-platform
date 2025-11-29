import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload } from "../finance/events";
import { distributedCache } from "./distributed_cache_manager";
import { financeDB } from "../finance/db";
import { toISTDateString, addDaysIST } from "../shared/date_utils";

export const cacheInvalidationSubscriber = new Subscription(
  financeEvents,
  "cache-invalidation-subscriber",
  {
    handler: async (event: FinanceEventPayload) => {
      console.log(`[CacheInvalidation] Processing event: ${event.eventType} for orgId: ${event.orgId}`);
      
      try {
        const affectedDates = event.metadata?.affectedReportDates || [];
        
        // Normalize dates to IST and add next day
        const datesToInvalidateSet = new Set<string>();
        affectedDates.forEach(date => {
          const normalizedDate = toISTDateString(date);
          datesToInvalidateSet.add(normalizedDate);
          datesToInvalidateSet.add(addDaysIST(normalizedDate, 1)); // Next day for opening balance
        });

        const datesToInvalidate = Array.from(datesToInvalidateSet);
        
        // Invalidate cache for all normalized dates
        for (const date of datesToInvalidate) {
          await distributedCache.invalidateDailyReport(event.orgId, event.propertyId, date);
          await distributedCache.invalidateBalance(event.orgId, event.propertyId, date);
        }

        // For deletions, also clear database cache
        if (event.eventType.includes('deleted')) {
          await clearDatabaseCache(event.orgId, event.propertyId, datesToInvalidate);
        }

        console.log(`[CacheInvalidation] Successfully invalidated cache for ${datesToInvalidate.length} IST dates`);
      } catch (error) {
        console.error(`[CacheInvalidation] Error:`, error);
        throw error; // Encore will retry
      }
    },
    ackDeadline: "60s",  // Increased from 30s to 60s for better reliability
    maxConcurrency: 5000  // Increased from 1000 to 5000 for 1M organizations
  }
);

async function clearDatabaseCache(orgId: number, propertyId: number, dates: string[]): Promise<void> {
  for (const date of dates) {
    await financeDB.exec`
      DELETE FROM daily_cash_balances 
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND balance_date = ${date}
    `;
  }
}
