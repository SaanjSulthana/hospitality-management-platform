import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload, realtimeUpdates } from "../finance/events";
import { distributedCache } from "../cache/distributed_cache_manager";
import { asyncCacheInvalidator } from "../cache/async_invalidator";
import { toISTDateString, addDaysIST } from "../shared/date_utils";
import { reportsDB } from "./db";

/**
 * Optional write-through recompute: synchronously updates daily_cash_balances
 * after cache invalidation for instant UI updates. Enable with ENABLE_SYNC_DCB_UPDATE=true.
 */
async function recomputeDailyCashBalance(orgId: number, propertyId: number, dateIST: string): Promise<void> {
  try {
    // Query approved transactions for the date
    const result = await reportsDB.queryRow<{ revenue: number; expenses: number }>`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount_cents ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) as expenses
      FROM (
        SELECT 'revenue' as type, amount_cents 
        FROM revenues 
        WHERE org_id = ${orgId} 
          AND property_id = ${propertyId}
          AND DATE(occurred_at AT TIME ZONE 'Asia/Kolkata') = ${dateIST}::date
          AND status = 'approved'
        
        UNION ALL
        
        SELECT 'expense' as type, amount_cents 
        FROM expenses 
        WHERE org_id = ${orgId} 
          AND property_id = ${propertyId}
          AND DATE(expense_date AT TIME ZONE 'Asia/Kolkata') = ${dateIST}::date
          AND status = 'approved'
      ) transactions
    `;

    if (!result) {
      console.log(`[WriteThrough] No transactions for ${dateIST}, skipping upsert`);
      return;
    }

    // Get previous day's closing balance for opening balance
    const prevDateIST = addDaysIST(dateIST, -1);
    const prevBalance = await reportsDB.queryRow<{ closing_balance_cents: number }>`
      SELECT closing_balance_cents 
      FROM daily_cash_balances 
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND report_date = ${prevDateIST}::date
      ORDER BY report_date DESC 
      LIMIT 1
    `;

    const openingBalanceCents = prevBalance?.closing_balance_cents || 0;
    const closingBalanceCents = openingBalanceCents + result.revenue - result.expenses;

    // Upsert daily_cash_balances
    await reportsDB.exec`
      INSERT INTO daily_cash_balances (
        org_id, property_id, report_date, 
        opening_balance_cents, closing_balance_cents, 
        total_revenue_cents, total_expenses_cents
      ) VALUES (
        ${orgId}, ${propertyId}, ${dateIST}::date,
        ${openingBalanceCents}, ${closingBalanceCents},
        ${result.revenue}, ${result.expenses}
      )
      ON CONFLICT (org_id, property_id, report_date)
      DO UPDATE SET
        opening_balance_cents = EXCLUDED.opening_balance_cents,
        closing_balance_cents = EXCLUDED.closing_balance_cents,
        total_revenue_cents = EXCLUDED.total_revenue_cents,
        total_expenses_cents = EXCLUDED.total_expenses_cents,
        updated_at = NOW()
    `;

    console.log(`[WriteThrough] ✅ Recomputed daily_cash_balance for ${dateIST}: opening=${openingBalanceCents}, closing=${closingBalanceCents}`);
  } catch (error) {
    console.error(`[WriteThrough] Failed to recompute daily_cash_balance for ${dateIST}:`, error);
    // Don't throw - this is optional optimization, not critical
  }
}

export const financeEventsSubscriber = new Subscription(
  financeEvents,
  "reports-finance-subscriber",
  {
    handler: async (event: FinanceEventPayload) => {
      const startTime = Date.now();
      console.log(`[Reports] Processing finance event: ${event.eventType} (${event.eventId}) for orgId: ${event.orgId}, propertyId: ${event.propertyId}`);
      
      try {
        // Handle different event types
        const eventTypes = [
          'revenue_added', 'expense_added',
          'revenue_approved', 'expense_approved', 
          'revenue_rejected', 'expense_rejected',
          'revenue_deleted', 'expense_deleted',
          'cash_balance_updated',
          // Recognize daily approval broadcast event (no report cache impact)
          'daily_approval_granted',
        ];
        
        if (!eventTypes.includes(event.eventType)) {
          console.warn(`[Reports] Unknown event type: ${event.eventType}, ignoring`);
          return;
        }
        
    // 🔥 CRITICAL FIX: Enhanced cache invalidation with IST normalization
    // Special-case: daily_approval_granted is an organizational broadcast used by UI
    // It does not change report aggregates directly; skip cache invalidation but still publish realtime update.
    if (event.eventType === 'daily_approval_granted') {
      await realtimeUpdates.publish({
        orgId: event.orgId,
        propertyId: event.propertyId,
        updateType: 'approval',
        timestamp: new Date(),
        eventType: event.eventType,
        entityId: event.entityId
      });
      console.log(`[Reports] Acknowledged daily_approval_granted (no report cache invalidation)`);
      return;
    }
    const affectedDates = event.metadata?.affectedReportDates || [];
    const transactionDate = event.metadata?.transactionDate;
    const datesToInvalidateSet = new Set<string>();

    // Normalize all dates to IST
    const normalizedDates = affectedDates.map(d => toISTDateString(d));
    const normalizedTransactionDate = transactionDate ? toISTDateString(transactionDate) : null;

    // Add all normalized dates
    normalizedDates.forEach(date => datesToInvalidateSet.add(date));
    if (normalizedTransactionDate) {
      datesToInvalidateSet.add(normalizedTransactionDate);
    }

    // 🔥 CRITICAL: Add next day for each date (opening balance dependency)
    normalizedDates.forEach(date => {
      const nextDay = addDaysIST(date, 1);
      datesToInvalidateSet.add(nextDay);
      console.log(`[Reports] 🔥 Adding next day IST cache invalidation: ${nextDay} for ${date}`);
    });

    if (normalizedTransactionDate) {
      const nextDay = addDaysIST(normalizedTransactionDate, 1);
      datesToInvalidateSet.add(nextDay);
      console.log(`[Reports] 🔥 Adding next day IST cache invalidation: ${nextDay} for transaction ${normalizedTransactionDate}`);
    }

    // Optional defensive invalidation (±1 day) for migration period
    if (process.env.CACHE_DEFENSIVE_INVALIDATION === 'true') {
      const allDates = Array.from(datesToInvalidateSet);
      allDates.forEach(date => {
        const prevDay = addDaysIST(date, -1);
        datesToInvalidateSet.add(prevDay);
        console.log(`[Reports] 🛡️ Defensive: adding previous day ${prevDay}`);
      });
    }

    const datesToInvalidate = Array.from(datesToInvalidateSet);

    // 🔥 ENHANCED LOGGING: Detailed invalidation debugging
    console.log(`[Reports] 🔥 Final invalidation set (IST):`, {
      eventType: event.eventType,
      originalDates: affectedDates,
      normalizedDates: normalizedDates,
      finalDatesToInvalidate: datesToInvalidate,
      includesNextDay: datesToInvalidate.some(d => d !== normalizedTransactionDate && normalizedDates.includes(addDaysIST(d, -1))),
      orgId: event.orgId,
      propertyId: event.propertyId,
      timestamp: new Date().toISOString()
    });

    if (datesToInvalidate.length > 0) {
      console.log(`[Reports] Invalidating cache immediately for dates: ${datesToInvalidate.join(', ')}`);
      
      // 🔥 CRITICAL: Invalidate cache immediately for instant UI updates
      await distributedCache.invalidateDateRange(
        event.orgId,
        event.propertyId,
        datesToInvalidate
      );
      
      // 🔥 OPTIONAL: Write-through recompute daily_cash_balances for instant DB updates
      if (process.env.ENABLE_SYNC_DCB_UPDATE === 'true') {
        for (const dateIST of datesToInvalidate) {
          await recomputeDailyCashBalance(event.orgId, event.propertyId, dateIST);
        }
      }
      
      // Also queue for batch processing as backup
      await asyncCacheInvalidator.addInvalidation(
        event.orgId,
        event.propertyId,
        datesToInvalidate,
        'high' // High priority for real-time updates
      );
    } else if (normalizedTransactionDate) {
      console.log(`[Reports] No affectedReportDates, using normalized transactionDate: ${normalizedTransactionDate}`);
      
      // Invalidate immediately
      await distributedCache.invalidateDateRange(
        event.orgId,
        event.propertyId,
        [normalizedTransactionDate]
      );
      
      // Optional write-through recompute
      if (process.env.ENABLE_SYNC_DCB_UPDATE === 'true') {
        await recomputeDailyCashBalance(event.orgId, event.propertyId, normalizedTransactionDate);
      }
      
      await asyncCacheInvalidator.addInvalidation(
        event.orgId,
        event.propertyId,
        [normalizedTransactionDate],
        'high'
      );
    } else {
      console.warn(`[Reports] No date information in event metadata for ${event.eventType}, invalidating today's cache (IST)`);
      const todayIST = toISTDateString(new Date());
      
      // Invalidate immediately
      await distributedCache.invalidateDateRange(
        event.orgId,
        event.propertyId,
        [todayIST]
      );
      
      // Optional write-through recompute
      if (process.env.ENABLE_SYNC_DCB_UPDATE === 'true') {
        await recomputeDailyCashBalance(event.orgId, event.propertyId, todayIST);
      }
      
      await asyncCacheInvalidator.addInvalidation(
        event.orgId,
        event.propertyId,
        [todayIST],
        'medium'
      );
    }
        
        // Determine update type for real-time notifications
        let updateType = 'transaction';
        if (event.entityType === 'cash_balance') {
          updateType = 'balance';
        } else if (event.eventType.includes('approval') || event.eventType.includes('rejected')) {
          updateType = 'approval';
        } else if (event.eventType.includes('deleted')) {
          updateType = 'deletion';
        }
        
        // Publish real-time update
        await realtimeUpdates.publish({
          orgId: event.orgId,
          propertyId: event.propertyId,
          updateType: updateType,
          timestamp: new Date(),
          eventType: event.eventType,
          entityId: event.entityId
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`[Reports] Successfully processed ${event.eventType} event in ${processingTime}ms`);
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[Reports] Error processing ${event.eventType} event after ${processingTime}ms:`, error);
        console.error(`[Reports] Event details:`, {
          eventId: event.eventId,
          eventType: event.eventType,
          orgId: event.orgId,
          propertyId: event.propertyId,
          entityId: event.entityId,
          metadata: event.metadata
        });
        throw error; // Encore will retry
      }
    },
    ackDeadline: "60s",  // Increased from 30s to 60s for better reliability
    maxConcurrency: 5000  // Increased from 500 to 5000 for 1M organizations
  }
);
