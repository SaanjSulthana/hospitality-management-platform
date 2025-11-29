// 🔥 PERMANENT FIX FOR BALANCE CARRY-FORWARD ISSUE
// This module provides a comprehensive solution for the balance carry-forward problem

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";
import { enhancedBalanceCache } from "./enhanced_balance_cache";
import { distributedCache } from "../cache/distributed_cache_manager";

export interface FixBalanceCarryForwardPermanentRequest {
  propertyId: number;
  startDate: string;
  endDate: string;
  forceRecalculation?: boolean;
}

export interface FixBalanceCarryForwardPermanentResponse {
  success: boolean;
  message: string;
  correctedDates: string[];
  details: {
    date: string;
    previousClosingBalance: number;
    newOpeningBalance: number;
    newClosingBalance: number;
    corrected: boolean;
    wasRealTime: boolean;
  }[];
  statistics: {
    totalDatesProcessed: number;
    datesCorrected: number;
    cacheInvalidations: number;
    realTimeCalculations: number;
  };
}

// 🔥 PERMANENT FIX: Comprehensive balance carry-forward correction
export const fixBalanceCarryForwardPermanent = api<FixBalanceCarryForwardPermanentRequest, FixBalanceCarryForwardPermanentResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/fix-balance-carry-forward-permanent" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { propertyId, startDate, endDate, forceRecalculation = false } = req;
    
    try {
      console.log(`[FixBalancePermanent] Starting comprehensive balance carry-forward fix for property ${propertyId} from ${startDate} to ${endDate}`);
      
      // Generate date range
      const dates = generateDateRange(startDate, endDate);
      const correctedDates: string[] = [];
      const details: any[] = [];
      let cacheInvalidations = 0;
      let realTimeCalculations = 0;
      
      for (const date of dates) {
        console.log(`[FixBalancePermanent] Processing date: ${date}`);
        
        try {
          // 🔥 CRITICAL: Get opening balance with real-time validation
          const openingBalanceResult = await enhancedBalanceCache.getOpeningBalanceWithValidation(
            propertyId,
            date,
            authData.orgId
          );
          
          if (openingBalanceResult.wasCorrected) {
            correctedDates.push(date);
            cacheInvalidations++;
          }
          
          if (openingBalanceResult.isRealTime) {
            realTimeCalculations++;
          }
          
          // 🔥 CRITICAL: Get closing balance with real-time validation
          const closingBalanceResult = await enhancedBalanceCache.getClosingBalanceWithValidation(
            propertyId,
            date,
            authData.orgId
          );
          
          if (closingBalanceResult.wasCorrected) {
            if (!correctedDates.includes(date)) {
              correctedDates.push(date);
            }
            cacheInvalidations++;
          }
          
          if (closingBalanceResult.isRealTime) {
            realTimeCalculations++;
          }
          
          // Get previous day's closing balance for reference
          const previousDate = new Date(date);
          previousDate.setDate(previousDate.getDate() - 1);
          const previousDateStr = previousDate.toISOString().split('T')[0];
          
          const previousBalance = await reportsDB.queryRow`
            SELECT closing_balance_cents 
            FROM daily_cash_balances 
            WHERE org_id = ${authData.orgId} 
              AND property_id = ${propertyId} 
              AND balance_date = ${previousDateStr}
          `;
          
          const previousClosingBalance = previousBalance ? parseInt(previousBalance.closing_balance_cents) || 0 : 0;
          
          details.push({
            date,
            previousClosingBalance,
            newOpeningBalance: openingBalanceResult.openingBalance,
            newClosingBalance: closingBalanceResult.closingBalance,
            corrected: openingBalanceResult.wasCorrected || closingBalanceResult.wasCorrected,
            wasRealTime: openingBalanceResult.isRealTime || closingBalanceResult.isRealTime
          });
          
          console.log(`[FixBalancePermanent] Processed ${date}:`, {
            openingBalance: openingBalanceResult.openingBalance,
            closingBalance: closingBalanceResult.closingBalance,
            corrected: openingBalanceResult.wasCorrected || closingBalanceResult.wasCorrected
          });
          
        } catch (dateError) {
          console.error(`[FixBalancePermanent] Error processing date ${date}:`, dateError);
          // Continue with other dates
        }
      }
      
      // 🔥 CRITICAL: Invalidate all related caches to ensure fresh data
      for (const date of dates) {
        await distributedCache.invalidateBalance(authData.orgId, propertyId, date);
        
        // Also invalidate next day's cache
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        await distributedCache.invalidateBalance(authData.orgId, propertyId, nextDateStr);
      }
      
      console.log(`[FixBalancePermanent] Completed comprehensive balance carry-forward fix. Corrected ${correctedDates.length} dates.`);
      
      return {
        success: true,
        message: `Successfully corrected balance carry-forward for ${correctedDates.length} dates with ${realTimeCalculations} real-time calculations`,
        correctedDates,
        details,
        statistics: {
          totalDatesProcessed: dates.length,
          datesCorrected: correctedDates.length,
          cacheInvalidations,
          realTimeCalculations
        }
      };
      
    } catch (error) {
      console.error('[FixBalancePermanent] Error fixing balance carry-forward:', error);
      throw APIError.internal("Failed to fix balance carry-forward permanently");
    }
  }
);

// 🔥 CRITICAL: Real-time balance validation endpoint
export const validateBalanceChain = api<{
  propertyId: number;
  date: string;
}, {
  isValid: boolean;
  discrepancies: {
    type: 'opening' | 'closing';
    stored: number;
    realTime: number;
    difference: number;
  }[];
  corrected: boolean;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/validate-balance-chain" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, date } = req;
    
    try {
      console.log(`[ValidateBalance] Validating balance chain for property ${propertyId} on ${date}`);
      
      const discrepancies: any[] = [];
      let corrected = false;
      
      // Check opening balance
      const openingBalanceResult = await enhancedBalanceCache.getOpeningBalanceWithValidation(
        propertyId,
        date,
        authData.orgId
      );
      
      if (openingBalanceResult.wasCorrected) {
        corrected = true;
      }
      
      // Check closing balance
      const closingBalanceResult = await enhancedBalanceCache.getClosingBalanceWithValidation(
        propertyId,
        date,
        authData.orgId
      );
      
      if (closingBalanceResult.wasCorrected) {
        corrected = true;
      }
      
      // Get stored values for comparison
      const storedBalance = await reportsDB.queryRow`
        SELECT opening_balance_cents, closing_balance_cents
        FROM daily_cash_balances
        WHERE org_id = ${authData.orgId}
          AND property_id = ${propertyId}
          AND balance_date = ${date}
      `;
      
      if (storedBalance) {
        const storedOpening = parseInt(storedBalance.opening_balance_cents) || 0;
        const storedClosing = parseInt(storedBalance.closing_balance_cents) || 0;
        
        if (storedOpening !== openingBalanceResult.openingBalance) {
          discrepancies.push({
            type: 'opening',
            stored: storedOpening,
            realTime: openingBalanceResult.openingBalance,
            difference: openingBalanceResult.openingBalance - storedOpening
          });
        }
        
        if (storedClosing !== closingBalanceResult.closingBalance) {
          discrepancies.push({
            type: 'closing',
            stored: storedClosing,
            realTime: closingBalanceResult.closingBalance,
            difference: closingBalanceResult.closingBalance - storedClosing
          });
        }
      }
      
      return {
        isValid: discrepancies.length === 0,
        discrepancies,
        corrected
      };
      
    } catch (error) {
      console.error('[ValidateBalance] Error validating balance chain:', error);
      throw APIError.internal("Failed to validate balance chain");
    }
  }
);

// 🔥 CRITICAL: Force cache invalidation for balance carry-forward
export const forceBalanceCacheInvalidation = api<{
  propertyId: number;
  startDate: string;
  endDate: string;
}, {
  success: boolean;
  invalidatedDates: string[];
  message: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/force-balance-cache-invalidation" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { propertyId, startDate, endDate } = req;
    
    try {
      console.log(`[ForceCacheInvalidation] Force invalidating balance cache for property ${propertyId} from ${startDate} to ${endDate}`);
      
      const dates = generateDateRange(startDate, endDate);
      const invalidatedDates: string[] = [];
      
      for (const date of dates) {
        // Invalidate current date
        await distributedCache.invalidateBalance(authData.orgId, propertyId, date);
        invalidatedDates.push(date);
        
        // Invalidate next day's cache (opening balance)
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
        await distributedCache.invalidateBalance(authData.orgId, propertyId, nextDateStr);
        if (!invalidatedDates.includes(nextDateStr)) {
          invalidatedDates.push(nextDateStr);
        }
      }
      
      console.log(`[ForceCacheInvalidation] Successfully invalidated cache for ${invalidatedDates.length} dates`);
      
      return {
        success: true,
        invalidatedDates,
        message: `Successfully invalidated cache for ${invalidatedDates.length} dates`
      };
      
    } catch (error) {
      console.error('[ForceCacheInvalidation] Error force invalidating cache:', error);
      throw APIError.internal("Failed to force cache invalidation");
    }
  }
);

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

