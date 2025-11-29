// 🔥 ENHANCED BALANCE CACHE STRATEGY FOR CARRY-FORWARD
// This module provides intelligent caching for balance carry-forward calculations

import { distributedCache } from "../cache/distributed_cache_manager";
import { reportsDB } from "./db";

export class EnhancedBalanceCache {
  private static instance: EnhancedBalanceCache;
  
  public static getInstance(): EnhancedBalanceCache {
    if (!EnhancedBalanceCache.instance) {
      EnhancedBalanceCache.instance = new EnhancedBalanceCache();
    }
    return EnhancedBalanceCache.instance;
  }

  // 🔥 CRITICAL: Get opening balance with real-time validation
  async getOpeningBalanceWithValidation(
    propertyId: number,
    date: string,
    orgId: number
  ): Promise<{
    openingBalance: number;
    isRealTime: boolean;
    wasCorrected: boolean;
  }> {
    const cacheKey = `opening_balance:${orgId}:${propertyId}:${date}`;
    
    try {
      // Try cache first
      const cached = await distributedCache.getBalance(orgId, propertyId, date);
      
      if (cached) {
        console.log(`[EnhancedBalanceCache] Found cached opening balance: ${cached.openingBalance}`);
        
        // 🔥 CRITICAL: Always validate cached balance against real-time calculation
        const realTimeBalance = await this.calculateRealTimeOpeningBalance(propertyId, date, orgId);
        
        if (cached.openingBalance !== realTimeBalance) {
          console.log(`[EnhancedBalanceCache] 🚨 CACHE MISMATCH DETECTED:`, {
            cached: cached.openingBalance,
            realTime: realTimeBalance,
            difference: realTimeBalance - cached.openingBalance
          });
          
          // Auto-correct the cache and database
          await this.correctBalanceChain(propertyId, date, orgId, realTimeBalance);
          
          return {
            openingBalance: realTimeBalance,
            isRealTime: true,
            wasCorrected: true
          };
        }
        
        return {
          openingBalance: cached.openingBalance,
          isRealTime: false,
          wasCorrected: false
        };
      }
      
      // Cache miss - calculate real-time
      const realTimeBalance = await this.calculateRealTimeOpeningBalance(propertyId, date, orgId);
      
      // Cache the result
      await distributedCache.setBalance(orgId, propertyId, date, {
        openingBalance: realTimeBalance,
        closingBalance: realTimeBalance, // Will be updated when closing balance is calculated
        lastUpdated: new Date().toISOString()
      });
      
      return {
        openingBalance: realTimeBalance,
        isRealTime: true,
        wasCorrected: false
      };
      
    } catch (error) {
      console.error('[EnhancedBalanceCache] Error getting opening balance:', error);
      // Fallback to real-time calculation
      const realTimeBalance = await this.calculateRealTimeOpeningBalance(propertyId, date, orgId);
      return {
        openingBalance: realTimeBalance,
        isRealTime: true,
        wasCorrected: false
      };
    }
  }

  // 🔥 CRITICAL: Calculate real-time opening balance from previous day's closing balance
  private async calculateRealTimeOpeningBalance(
    propertyId: number,
    date: string,
    orgId: number
  ): Promise<number> {
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    console.log(`[EnhancedBalanceCache] Calculating real-time opening balance for ${date} from ${previousDateStr}`);
    
    // Get all cash transactions up to the end of the previous day
    const allRevenues = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM revenues
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND occurred_at <= ${previousDateStr}::date + INTERVAL '1 day' - INTERVAL '1 second'
        AND status = 'approved'
    `;
    
    const allExpenses = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM expenses
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND expense_date <= ${previousDateStr}::date
        AND status = 'approved'
    `;
    
    // Calculate total cash flow up to the end of the previous day
    const totalCashRevenue = (allRevenues || [])
      .filter((r: any) => r.payment_mode === 'cash')
      .reduce((sum: number, r: any) => sum + (parseInt(r.amount_cents) || 0), 0);
    
    const totalCashExpenses = (allExpenses || [])
      .filter((e: any) => e.payment_mode === 'cash')
      .reduce((sum: number, e: any) => sum + (parseInt(e.amount_cents) || 0), 0);
    
    // Opening balance is the net cash flow up to the end of the previous day
    const openingBalance = totalCashRevenue - totalCashExpenses;
    
    console.log(`[EnhancedBalanceCache] Real-time opening balance calculated:`, {
      date,
      previousDateStr,
      totalCashRevenue,
      totalCashExpenses,
      openingBalance
    });
    
    return openingBalance;
  }

  // 🔥 CRITICAL: Correct the entire balance chain when a mismatch is detected
  private async correctBalanceChain(
    propertyId: number,
    date: string,
    orgId: number,
    correctOpeningBalance: number
  ): Promise<void> {
    console.log(`[EnhancedBalanceCache] 🔧 Correcting balance chain for ${date} with opening balance: ${correctOpeningBalance}`);
    
    try {
      // Update the daily_cash_balances record
      await reportsDB.exec`
        UPDATE daily_cash_balances 
        SET 
          opening_balance_cents = ${correctOpeningBalance},
          closing_balance_cents = opening_balance_cents + cash_received_cents - cash_expenses_cents,
          calculated_closing_balance_cents = opening_balance_cents + cash_received_cents - cash_expenses_cents,
          balance_discrepancy_cents = 0,
          updated_at = NOW()
        WHERE org_id = ${orgId} 
          AND property_id = ${propertyId} 
          AND balance_date = ${date}
      `;
      
      // Invalidate cache for this date and the next day
      await distributedCache.invalidateBalance(orgId, propertyId, date);
      await distributedCache.invalidateDailyReport(orgId, propertyId, date);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      await distributedCache.invalidateBalance(orgId, propertyId, nextDateStr);
      await distributedCache.invalidateDailyReport(orgId, propertyId, nextDateStr);
      
      console.log(`[EnhancedBalanceCache] ✅ Balance chain corrected for ${date}`);
      
    } catch (error) {
      console.error('[EnhancedBalanceCache] Error correcting balance chain:', error);
      throw error;
    }
  }

  // 🔥 CRITICAL: Invalidate cache when transactions change
  async invalidateBalanceCache(
    orgId: number,
    propertyId: number,
    transactionDate: string
  ): Promise<void> {
    console.log(`[EnhancedBalanceCache] 🗑️ Invalidating balance cache for transaction date: ${transactionDate}`);
    
    try {
      // Invalidate cache for the transaction date
      await distributedCache.invalidateBalance(orgId, propertyId, transactionDate);
      await distributedCache.invalidateDailyReport(orgId, propertyId, transactionDate);
      
      // 🔥 CRITICAL: Also invalidate the next day's cache (opening balance)
      const nextDate = new Date(transactionDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      await distributedCache.invalidateBalance(orgId, propertyId, nextDateStr);
      await distributedCache.invalidateDailyReport(orgId, propertyId, nextDateStr);
      
      console.log(`[EnhancedBalanceCache] ✅ Cache invalidated for ${transactionDate} and ${nextDateStr}`);
      
    } catch (error) {
      console.error('[EnhancedBalanceCache] Error invalidating cache:', error);
      throw error;
    }
  }

  // 🔥 CRITICAL: Get closing balance with real-time validation
  async getClosingBalanceWithValidation(
    propertyId: number,
    date: string,
    orgId: number
  ): Promise<{
    closingBalance: number;
    isRealTime: boolean;
    wasCorrected: boolean;
  }> {
    const cacheKey = `closing_balance:${orgId}:${propertyId}:${date}`;
    
    try {
      // Try cache first
      const cached = await distributedCache.getBalance(orgId, propertyId, date);
      
      if (cached) {
        console.log(`[EnhancedBalanceCache] Found cached closing balance: ${cached.closingBalance}`);
        
        // 🔥 CRITICAL: Always validate cached balance against real-time calculation
        const realTimeBalance = await this.calculateRealTimeClosingBalance(propertyId, date, orgId);
        
        if (cached.closingBalance !== realTimeBalance) {
          console.log(`[EnhancedBalanceCache] 🚨 CLOSING BALANCE MISMATCH DETECTED:`, {
            cached: cached.closingBalance,
            realTime: realTimeBalance,
            difference: realTimeBalance - cached.closingBalance
          });
          
          // Auto-correct the cache and database
          await this.correctClosingBalance(propertyId, date, orgId, realTimeBalance);
          
          return {
            closingBalance: realTimeBalance,
            isRealTime: true,
            wasCorrected: true
          };
        }
        
        return {
          closingBalance: cached.closingBalance,
          isRealTime: false,
          wasCorrected: false
        };
      }
      
      // Cache miss - calculate real-time
      const realTimeBalance = await this.calculateRealTimeClosingBalance(propertyId, date, orgId);
      
      // Cache the result
      await distributedCache.setBalance(orgId, propertyId, date, {
        openingBalance: 0, // Will be updated separately
        closingBalance: realTimeBalance,
        lastUpdated: new Date().toISOString()
      });
      
      return {
        closingBalance: realTimeBalance,
        isRealTime: true,
        wasCorrected: false
      };
      
    } catch (error) {
      console.error('[EnhancedBalanceCache] Error getting closing balance:', error);
      // Fallback to real-time calculation
      const realTimeBalance = await this.calculateRealTimeClosingBalance(propertyId, date, orgId);
      return {
        closingBalance: realTimeBalance,
        isRealTime: true,
        wasCorrected: false
      };
    }
  }

  // 🔥 CRITICAL: Calculate real-time closing balance from transactions
  private async calculateRealTimeClosingBalance(
    propertyId: number,
    date: string,
    orgId: number
  ): Promise<number> {
    console.log(`[EnhancedBalanceCache] Calculating real-time closing balance for ${date}`);
    
    // Get all cash transactions up to the end of the given date
    const allRevenues = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM revenues
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND occurred_at <= ${date}::date + INTERVAL '1 day' - INTERVAL '1 second'
        AND status = 'approved'
    `;
    
    const allExpenses = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM expenses
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND expense_date <= ${date}::date
        AND status = 'approved'
    `;
    
    // Calculate total cash flow up to the end of the given date
    const totalCashRevenue = (allRevenues || [])
      .filter((r: any) => r.payment_mode === 'cash')
      .reduce((sum: number, r: any) => sum + (parseInt(r.amount_cents) || 0), 0);
    
    const totalCashExpenses = (allExpenses || [])
      .filter((e: any) => e.payment_mode === 'cash')
      .reduce((sum: number, e: any) => sum + (parseInt(e.amount_cents) || 0), 0);
    
    // Closing balance is the net cash flow up to the end of the given date
    const closingBalance = totalCashRevenue - totalCashExpenses;
    
    console.log(`[EnhancedBalanceCache] Real-time closing balance calculated:`, {
      date,
      totalCashRevenue,
      totalCashExpenses,
      closingBalance
    });
    
    return closingBalance;
  }

  // 🔥 CRITICAL: Correct closing balance when a mismatch is detected
  private async correctClosingBalance(
    propertyId: number,
    date: string,
    orgId: number,
    correctClosingBalance: number
  ): Promise<void> {
    console.log(`[EnhancedBalanceCache] 🔧 Correcting closing balance for ${date} with value: ${correctClosingBalance}`);
    
    try {
      // Update the daily_cash_balances record
      await reportsDB.exec`
        UPDATE daily_cash_balances 
        SET 
          closing_balance_cents = ${correctClosingBalance},
          calculated_closing_balance_cents = ${correctClosingBalance},
          balance_discrepancy_cents = 0,
          updated_at = NOW()
        WHERE org_id = ${orgId} 
          AND property_id = ${propertyId} 
          AND balance_date = ${date}
      `;
      
      // Invalidate cache for this date and the next day
      await distributedCache.invalidateBalance(orgId, propertyId, date);
      await distributedCache.invalidateDailyReport(orgId, propertyId, date);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      await distributedCache.invalidateBalance(orgId, propertyId, nextDateStr);
      await distributedCache.invalidateDailyReport(orgId, propertyId, nextDateStr);
      
      console.log(`[EnhancedBalanceCache] ✅ Closing balance corrected for ${date}`);
      
    } catch (error) {
      console.error('[EnhancedBalanceCache] Error correcting closing balance:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedBalanceCache = EnhancedBalanceCache.getInstance();

