import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";
import { distributedCache } from "../cache/distributed_cache_manager";

// Helper function to generate date range
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

// Helper function to calculate correct balance from transactions
async function calculateCorrectBalance(
  propertyId: number, 
  date: string, 
  orgId: number
): Promise<{
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
}> {
  // Get revenues
  const revenues = await reportsDB.queryAll`
    SELECT amount_cents, payment_mode
    FROM revenues
    WHERE property_id = ${propertyId}
      AND org_id = ${orgId}
      AND occurred_at::date = ${date}::date
      AND status = 'approved'
  `;

  // Get expenses
  const expenses = await reportsDB.queryAll`
    SELECT amount_cents, payment_mode
    FROM expenses
    WHERE property_id = ${propertyId}
      AND org_id = ${orgId}
      AND expense_date::date = ${date}::date
      AND status = 'approved'
  `;

  let cashIn = 0;
  let bankIn = 0;
  let cashOut = 0;
  let bankOut = 0;

  revenues.forEach((r: any) => {
    const amount = parseInt(r.amount_cents) || 0;
    if (r.payment_mode === 'cash') {
      cashIn += amount;
    } else {
      bankIn += amount;
    }
  });

  expenses.forEach((e: any) => {
    const amount = parseInt(e.amount_cents) || 0;
    if (e.payment_mode === 'cash') {
      cashOut += amount;
    } else {
      bankOut += amount;
    }
  });

  return { cashIn, cashOut, bankIn, bankOut };
}

export const fixBalanceChain = api<{
  propertyId: number;
  startDate: string;
  endDate: string;
  dryRun?: boolean;
}, {
  fixed: number;
  errors: Array<{date: string; error: string}>;
  changes: Array<{
    date: string;
    oldOpening?: number;
    newOpening: number;
    oldClosing?: number;
    newClosing: number;
    cashIn: number;
    cashOut: number;
  }>;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/fix-balance-chain" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { propertyId, startDate, endDate, dryRun = true } = req;
    let fixed = 0;
    const errors: Array<{date: string; error: string}> = [];
    const changes: Array<{
      date: string;
      oldOpening?: number;
      newOpening: number;
      oldClosing?: number;
      newClosing: number;
      cashIn: number;
      cashOut: number;
    }> = [];

    try {
      // Check property access
      const propertyCheck = await reportsDB.queryRow`
        SELECT p.id, p.name, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyCheck) {
        throw APIError.notFound("Property not found");
      }

      // Get all dates in range
      const dates = generateDateRange(startDate, endDate);
      
      let previousClosing = 0;
      
      for (const date of dates) {
        try {
          // Get existing record if any
          const existing = await reportsDB.queryRow`
            SELECT 
              opening_balance_cents,
              closing_balance_cents,
              cash_received_cents,
              bank_received_cents,
              cash_expenses_cents,
              bank_expenses_cents
            FROM daily_cash_balances
            WHERE org_id = ${authData.orgId}
              AND property_id = ${propertyId}
              AND balance_date = ${date}::date
          `;

          // Calculate correct values from transactions
          const calculated = await calculateCorrectBalance(propertyId, date, authData.orgId);
          
          const correctOpening = previousClosing;
          const correctClosing = correctOpening + calculated.cashIn - calculated.cashOut;
          
          // Record the change
          changes.push({
            date,
            oldOpening: existing ? parseInt(existing.opening_balance_cents) : undefined,
            newOpening: correctOpening,
            oldClosing: existing ? parseInt(existing.closing_balance_cents) : undefined,
            newClosing: correctClosing,
            cashIn: calculated.cashIn,
            cashOut: calculated.cashOut,
          });

          if (!dryRun) {
            // Upsert the record with correct values
            await reportsDB.exec`
              INSERT INTO daily_cash_balances (
                org_id, property_id, balance_date, opening_balance_cents,
                cash_received_cents, bank_received_cents, cash_expenses_cents,
                bank_expenses_cents, closing_balance_cents,
                is_opening_balance_auto_calculated, calculated_closing_balance_cents,
                balance_discrepancy_cents, created_by_user_id
              )
              VALUES (
                ${authData.orgId}, ${propertyId}, ${date}::date, ${correctOpening},
                ${calculated.cashIn}, ${calculated.bankIn}, ${calculated.cashOut},
                ${calculated.bankOut}, ${correctClosing}, true, 
                ${correctClosing}, 0, ${parseInt(authData.userID)}
              )
              ON CONFLICT (org_id, property_id, balance_date)
              DO UPDATE SET
                opening_balance_cents = EXCLUDED.opening_balance_cents,
                cash_received_cents = EXCLUDED.cash_received_cents,
                bank_received_cents = EXCLUDED.bank_received_cents,
                cash_expenses_cents = EXCLUDED.cash_expenses_cents,
                bank_expenses_cents = EXCLUDED.bank_expenses_cents,
                closing_balance_cents = EXCLUDED.closing_balance_cents,
                is_opening_balance_auto_calculated = EXCLUDED.is_opening_balance_auto_calculated,
                calculated_closing_balance_cents = EXCLUDED.calculated_closing_balance_cents,
                balance_discrepancy_cents = EXCLUDED.balance_discrepancy_cents,
                updated_at = NOW()
            `;
            
            // Invalidate cache for this date and next date
            reportsCache.invalidateByDates(authData.orgId, propertyId, [date]);
          }
          
          previousClosing = correctClosing;
          fixed++;
        } catch (error: any) {
          errors.push({ date, error: error.message });
        }
      }

      return { fixed, errors, changes };
    } catch (error) {
      console.error('Fix balance chain error:', error);
      throw APIError.internal("Failed to fix balance chain");
    }
  }
);

// Quick fix for a single date
export const fixSingleDate = api<{
  propertyId: number;
  date: string;
  dryRun?: boolean;
}, {
  success: boolean;
  change?: {
    date: string;
    oldOpening?: number;
    newOpening: number;
    oldClosing?: number;
    newClosing: number;
    cashIn: number;
    cashOut: number;
  };
  error?: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/fix-single-date" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { propertyId, date, dryRun = true } = req;

    try {
      // Get previous day's closing balance
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
      
      const openingBalance = previousBalance ? parseInt(previousBalance.closing_balance_cents) : 0;

      // Get existing record
      const existing = await reportsDB.queryRow`
        SELECT 
          opening_balance_cents,
          closing_balance_cents,
          cash_received_cents,
          bank_received_cents,
          cash_expenses_cents,
          bank_expenses_cents
        FROM daily_cash_balances
        WHERE org_id = ${authData.orgId}
          AND property_id = ${propertyId}
          AND balance_date = ${date}::date
      `;

      // Calculate correct values
      const calculated = await calculateCorrectBalance(propertyId, date, authData.orgId);
      const correctClosing = openingBalance + calculated.cashIn - calculated.cashOut;

      const change = {
        date,
        oldOpening: existing ? parseInt(existing.opening_balance_cents) : undefined,
        newOpening: openingBalance,
        oldClosing: existing ? parseInt(existing.closing_balance_cents) : undefined,
        newClosing: correctClosing,
        cashIn: calculated.cashIn,
        cashOut: calculated.cashOut,
      };

      if (!dryRun) {
        // Upsert the record
        await reportsDB.exec`
          INSERT INTO daily_cash_balances (
            org_id, property_id, balance_date, opening_balance_cents,
            cash_received_cents, bank_received_cents, cash_expenses_cents,
            bank_expenses_cents, closing_balance_cents,
            is_opening_balance_auto_calculated, calculated_closing_balance_cents,
            balance_discrepancy_cents, created_by_user_id
          )
          VALUES (
            ${authData.orgId}, ${propertyId}, ${date}::date, ${openingBalance},
            ${calculated.cashIn}, ${calculated.bankIn}, ${calculated.cashOut},
            ${calculated.bankOut}, ${correctClosing}, true, 
            ${correctClosing}, 0, ${parseInt(authData.userID)}
          )
          ON CONFLICT (org_id, property_id, balance_date)
          DO UPDATE SET
            opening_balance_cents = EXCLUDED.opening_balance_cents,
            cash_received_cents = EXCLUDED.cash_received_cents,
            bank_received_cents = EXCLUDED.bank_received_cents,
            cash_expenses_cents = EXCLUDED.cash_expenses_cents,
            bank_expenses_cents = EXCLUDED.bank_expenses_cents,
            closing_balance_cents = EXCLUDED.closing_balance_cents,
            is_opening_balance_auto_calculated = EXCLUDED.is_opening_balance_auto_calculated,
            calculated_closing_balance_cents = EXCLUDED.calculated_closing_balance_cents,
            balance_discrepancy_cents = EXCLUDED.balance_discrepancy_cents,
            updated_at = NOW()
        `;
        
        // Invalidate cache
        reportsCache.invalidateByDates(authData.orgId, propertyId, [date]);
      }

      return { success: true, change };
    } catch (error: any) {
      console.error('Fix single date error:', error);
      return { success: false, error: error.message };
    }
  }
);
