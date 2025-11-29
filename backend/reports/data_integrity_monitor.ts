import { api, APIError } from "encore.dev/api";
import { reportsDB } from "./db";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

// Monitor data integrity across date range
export const checkDataIntegrity = api<{
  propertyId: number;
  startDate: string;
  endDate: string;
}, {
  issues: Array<{
    date: string;
    discrepancies: any;
  }>;
  totalIssues: number;
}>(
  { auth: true, expose: true, method: "GET", path: "/reports/check-integrity" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) throw new Error("Unauthenticated");
    requireRole("ADMIN")(authData);

    const { propertyId, startDate, endDate } = req;
    const issues: any[] = [];

    // Generate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Check each date
    for (const date of dates) {
      // Get stored values
      const stored = await reportsDB.queryRow`
        SELECT cash_received_cents, bank_received_cents, cash_expenses_cents, bank_expenses_cents
        FROM daily_cash_balances
        WHERE org_id = ${authData.orgId} AND property_id = ${propertyId} AND balance_date = ${date}
      `;

      if (!stored) continue;

      // Get actual transaction totals
      const transactions = await reportsDB.queryAll`
        SELECT amount_cents, payment_mode, 'revenue' as type
        FROM revenues
        WHERE org_id = ${authData.orgId} AND property_id = ${propertyId}
          AND DATE(occurred_at AT TIME ZONE 'Asia/Kolkata') = ${date} AND status = 'approved'
        UNION ALL
        SELECT amount_cents, payment_mode, 'expense' as type
        FROM expenses
        WHERE org_id = ${authData.orgId} AND property_id = ${propertyId}
          AND expense_date = ${date} AND status = 'approved'
      `;

      let actualCashReceived = 0, actualBankReceived = 0;
      let actualCashExpenses = 0, actualBankExpenses = 0;
      
      transactions.forEach((tx: any) => {
        const amount = parseInt(tx.amount_cents) || 0;
        if (tx.type === 'revenue') {
          if (tx.payment_mode === 'cash') actualCashReceived += amount;
          else actualBankReceived += amount;
        } else {
          if (tx.payment_mode === 'cash') actualCashExpenses += amount;
          else actualBankExpenses += amount;
        }
      });

      // Check for discrepancies
      const storedCashReceived = parseInt(stored.cash_received_cents) || 0;
      const storedBankReceived = parseInt(stored.bank_received_cents) || 0;
      const storedCashExpenses = parseInt(stored.cash_expenses_cents) || 0;
      const storedBankExpenses = parseInt(stored.bank_expenses_cents) || 0;

      if (storedCashReceived !== actualCashReceived ||
          storedBankReceived !== actualBankReceived ||
          storedCashExpenses !== actualCashExpenses ||
          storedBankExpenses !== actualBankExpenses) {
        issues.push({
          date,
          discrepancies: {
            cashReceived: { stored: storedCashReceived, actual: actualCashReceived },
            bankReceived: { stored: storedBankReceived, actual: actualBankReceived },
            cashExpenses: { stored: storedCashExpenses, actual: actualCashExpenses },
            bankExpenses: { stored: storedBankExpenses, actual: actualBankExpenses }
          }
        });
      }
    }

    return { issues, totalIssues: issues.length };
  }
);
