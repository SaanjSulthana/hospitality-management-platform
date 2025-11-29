import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

export interface FixBalanceCarryForwardRequest {
  propertyId: number;
  startDate: string;
  endDate: string;
}

export interface FixBalanceCarryForwardResponse {
  success: boolean;
  message: string;
  correctedDates: string[];
  details: {
    date: string;
    previousClosingBalance: number;
    newOpeningBalance: number;
    corrected: boolean;
  }[];
}

// Fix balance carry-forward issue by recalculating daily_cash_balances records
export const fixBalanceCarryForward = api<FixBalanceCarryForwardRequest, FixBalanceCarryForwardResponse>(
  { auth: true, expose: true, method: "POST", path: "/reports/fix-balance-carry-forward" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { propertyId, startDate, endDate } = req;
    
    try {
      console.log(`[FixBalance] Starting balance carry-forward fix for property ${propertyId} from ${startDate} to ${endDate}`);
      
      // Generate date range
      const dates = generateDateRange(startDate, endDate);
      const correctedDates: string[] = [];
      const details: any[] = [];
      
      for (const date of dates) {
        console.log(`[FixBalance] Processing date: ${date}`);
        
        // Get the previous day's closing balance
        const previousDate = new Date(date);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().split('T')[0];
        
        let previousClosingBalance = 0;
        
        // Check if there's a daily_cash_balances record for the previous day
        const previousBalance = await reportsDB.queryRow`
          SELECT closing_balance_cents 
          FROM daily_cash_balances 
          WHERE org_id = ${authData.orgId} 
            AND property_id = ${propertyId} 
            AND balance_date = ${previousDateStr}
        `;
        
        if (previousBalance) {
          previousClosingBalance = parseInt(previousBalance.closing_balance_cents) || 0;
        } else {
          // Calculate from all transactions up to the previous day
          const allRevenues = await reportsDB.queryAll`
            SELECT amount_cents, payment_mode
            FROM revenues
            WHERE org_id = ${authData.orgId}
              AND property_id = ${propertyId}
              AND occurred_at < ${date}::date
              AND status = 'approved'
          `;
          
          const allExpenses = await reportsDB.queryAll`
            SELECT amount_cents, payment_mode
            FROM expenses
            WHERE org_id = ${authData.orgId}
              AND property_id = ${propertyId}
              AND expense_date < ${date}::date
              AND status = 'approved'
          `;
          
          let totalCashIn = 0;
          let totalCashOut = 0;
          
          allRevenues.forEach((r: any) => {
            if (r.payment_mode === 'cash') {
              totalCashIn += parseInt(r.amount_cents) || 0;
            }
          });
          
          allExpenses.forEach((e: any) => {
            if (e.payment_mode === 'cash') {
              totalCashOut += parseInt(e.amount_cents) || 0;
            }
          });
          
          previousClosingBalance = totalCashIn - totalCashOut;
        }
        
        // Get current day's transactions
        const dayRevenues = await reportsDB.queryAll`
          SELECT amount_cents, payment_mode
          FROM revenues
          WHERE org_id = ${authData.orgId}
            AND property_id = ${propertyId}
            AND occurred_at::date = ${date}::date
            AND status = 'approved'
        `;
        
        const dayExpenses = await reportsDB.queryAll`
          SELECT amount_cents, payment_mode
          FROM expenses
          WHERE org_id = ${authData.orgId}
            AND property_id = ${propertyId}
            AND expense_date::date = ${date}::date
            AND status = 'approved'
        `;
        
        // Calculate current day's totals
        let cashReceived = 0;
        let bankReceived = 0;
        let cashExpenses = 0;
        let bankExpenses = 0;
        
        dayRevenues.forEach((r: any) => {
          const amount = parseInt(r.amount_cents) || 0;
          if (r.payment_mode === 'cash') {
            cashReceived += amount;
          } else {
            bankReceived += amount;
          }
        });
        
        dayExpenses.forEach((e: any) => {
          const amount = parseInt(e.amount_cents) || 0;
          if (e.payment_mode === 'cash') {
            cashExpenses += amount;
          } else {
            bankExpenses += amount;
          }
        });
        
        const newOpeningBalance = previousClosingBalance;
        const newClosingBalance = newOpeningBalance + cashReceived - cashExpenses;
        
        // Check if daily_cash_balances record exists
        const existingRecord = await reportsDB.queryRow`
          SELECT id, opening_balance_cents, closing_balance_cents
          FROM daily_cash_balances
          WHERE org_id = ${authData.orgId}
            AND property_id = ${propertyId}
            AND balance_date = ${date}
        `;
        
        if (existingRecord) {
          // Update existing record
          await reportsDB.exec`
            UPDATE daily_cash_balances
            SET 
              opening_balance_cents = ${newOpeningBalance},
              cash_received_cents = ${cashReceived},
              bank_received_cents = ${bankReceived},
              cash_expenses_cents = ${cashExpenses},
              bank_expenses_cents = ${bankExpenses},
              closing_balance_cents = ${newClosingBalance},
              calculated_closing_balance_cents = ${newClosingBalance},
              balance_discrepancy_cents = 0,
              is_opening_balance_auto_calculated = ${previousClosingBalance > 0},
              updated_at = NOW()
            WHERE id = ${existingRecord.id}
          `;
          
          console.log(`[FixBalance] Updated existing record for ${date}: opening=${newOpeningBalance}, closing=${newClosingBalance}`);
        } else {
          // Create new record
          await reportsDB.exec`
            INSERT INTO daily_cash_balances (
              org_id, property_id, balance_date, opening_balance_cents,
              cash_received_cents, bank_received_cents, cash_expenses_cents,
              bank_expenses_cents, closing_balance_cents,
              is_opening_balance_auto_calculated, calculated_closing_balance_cents,
              balance_discrepancy_cents, created_by_user_id, created_at, updated_at
            )
            VALUES (
              ${authData.orgId}, ${propertyId}, ${date}, ${newOpeningBalance},
              ${cashReceived}, ${bankReceived}, ${cashExpenses}, ${bankExpenses},
              ${newClosingBalance}, ${previousClosingBalance > 0}, ${newClosingBalance},
              0, ${parseInt(authData.userID)}, NOW(), NOW()
            )
          `;
          
          console.log(`[FixBalance] Created new record for ${date}: opening=${newOpeningBalance}, closing=${newClosingBalance}`);
        }
        
        correctedDates.push(date);
        details.push({
          date,
          previousClosingBalance,
          newOpeningBalance,
          corrected: true
        });
      }
      
      console.log(`[FixBalance] Completed balance carry-forward fix. Corrected ${correctedDates.length} dates.`);
      
      return {
        success: true,
        message: `Successfully corrected balance carry-forward for ${correctedDates.length} dates`,
        correctedDates,
        details
      };
      
    } catch (error) {
      console.error('[FixBalance] Error fixing balance carry-forward:', error);
      throw APIError.internal("Failed to fix balance carry-forward");
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
