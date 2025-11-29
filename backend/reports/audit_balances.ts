import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

export interface BalanceAuditResult {
  date: string;
  propertyId: number;
  propertyName: string;
  openingBalanceCents: number;
  cashReceivedCents: number;
  bankReceivedCents: number;
  cashExpensesCents: number;
  bankExpensesCents: number;
  closingBalanceCents: number;
  calculatedClosingCents: number;
  discrepancyCents: number;
  nextDayOpeningCents: number | null;
  cascadeErrorCents: number;
  isAutoCalculated: boolean;
  hasMismatch: boolean;
}

// Shared handler for auditing property balances
async function auditPropertyBalancesHandler(req: {
  propertyId: number;
  startDate: string;
  endDate: string;
}): Promise<{
  audits: BalanceAuditResult[];
  summary: {
    totalDates: number;
    datesWithMismatch: number;
    datesWithDiscrepancy: number;
  };
}> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate } = req;

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

      // Get all daily_cash_balances with next day data
      const results = await reportsDB.queryAll`
        SELECT 
          dcb.balance_date,
          dcb.property_id,
          ${propertyCheck.name} as property_name,
          dcb.opening_balance_cents,
          dcb.cash_received_cents,
          dcb.bank_received_cents,
          dcb.cash_expenses_cents,
          dcb.bank_expenses_cents,
          dcb.closing_balance_cents,
          dcb.calculated_closing_balance_cents,
          dcb.balance_discrepancy_cents,
          dcb.is_opening_balance_auto_calculated,
          next_day.opening_balance_cents as next_day_opening_cents,
          dcb.created_at,
          dcb.updated_at
        FROM daily_cash_balances dcb
        LEFT JOIN daily_cash_balances next_day 
          ON next_day.property_id = dcb.property_id 
          AND next_day.org_id = dcb.org_id
          AND next_day.balance_date = dcb.balance_date + INTERVAL '1 day'
        WHERE dcb.org_id = ${authData.orgId}
          AND dcb.property_id = ${propertyId}
          AND dcb.balance_date >= ${startDate}::date
          AND dcb.balance_date <= ${endDate}::date
        ORDER BY dcb.balance_date
      `;

      const audits: BalanceAuditResult[] = results.map((row: any) => {
        const closingCents = parseInt(row.closing_balance_cents) || 0;
        const nextDayOpeningCents = row.next_day_opening_cents ? parseInt(row.next_day_opening_cents) : null;
        const cascadeError = nextDayOpeningCents !== null ? closingCents - nextDayOpeningCents : 0;
        const discrepancy = parseInt(row.balance_discrepancy_cents) || 0;

        return {
          date: row.balance_date,
          propertyId: parseInt(row.property_id),
          propertyName: row.property_name,
          openingBalanceCents: parseInt(row.opening_balance_cents) || 0,
          cashReceivedCents: parseInt(row.cash_received_cents) || 0,
          bankReceivedCents: parseInt(row.bank_received_cents) || 0,
          cashExpensesCents: parseInt(row.cash_expenses_cents) || 0,
          bankExpensesCents: parseInt(row.bank_expenses_cents) || 0,
          closingBalanceCents: closingCents,
          calculatedClosingCents: parseInt(row.calculated_closing_balance_cents) || 0,
          discrepancyCents: discrepancy,
          nextDayOpeningCents: nextDayOpeningCents,
          cascadeErrorCents: cascadeError,
          isAutoCalculated: row.is_opening_balance_auto_calculated || false,
          hasMismatch: cascadeError !== 0,
        };
      });

      const summary = {
        totalDates: audits.length,
        datesWithMismatch: audits.filter(a => a.hasMismatch).length,
        datesWithDiscrepancy: audits.filter(a => Math.abs(a.discrepancyCents) > 0).length,
      };

      return { audits, summary };
    } catch (error) {
      console.error('Audit balances error:', error);
      throw APIError.internal("Failed to audit balances");
    }
}

// LEGACY: Audit property balances (keep for backward compatibility)
export const auditPropertyBalances = api<{
  propertyId: number;
  startDate: string;
  endDate: string;
}, {
  audits: BalanceAuditResult[];
  summary: {
    totalDates: number;
    datesWithMismatch: number;
    datesWithDiscrepancy: number;
  };
}>(
  { auth: true, expose: true, method: "GET", path: "/reports/audit-balances" },
  auditPropertyBalancesHandler
);

// V1: Audit property balances
export const auditPropertyBalancesV1 = api<{
  propertyId: number;
  startDate: string;
  endDate: string;
}, {
  audits: BalanceAuditResult[];
  summary: {
    totalDates: number;
    datesWithMismatch: number;
    datesWithDiscrepancy: number;
  };
}>(
  { auth: true, expose: true, method: "GET", path: "/v1/reports/audit-balances" },
  auditPropertyBalancesHandler
);

// Shared handler for getting transactions for a specific date
async function getDateTransactionsHandler(req: {
  propertyId: number;
  date: string;
}): Promise<{
  transactions: Array<{
    type: 'revenue' | 'expense';
    amountCents: number;
    paymentMode: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  summary: {
    cashRevenue: number;
    bankRevenue: number;
    cashExpenses: number;
    bankExpenses: number;
    calculatedClosing: number;
  };
}> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }

    const { propertyId, date } = req;

    try {
      // Get revenues
      const revenues = await reportsDB.queryAll`
        SELECT 
          'revenue' as type,
          amount_cents,
          payment_mode,
          source as category,
          status,
          created_at
        FROM revenues
        WHERE property_id = ${propertyId}
          AND org_id = ${authData.orgId}
          AND occurred_at::date = ${date}::date
          AND status = 'approved'
      `;

      // Get expenses
      const expenses = await reportsDB.queryAll`
        SELECT 
          'expense' as type,
          amount_cents,
          payment_mode,
          category,
          status,
          created_at
        FROM expenses
        WHERE property_id = ${propertyId}
          AND org_id = ${authData.orgId}
          AND expense_date::date = ${date}::date
          AND status = 'approved'
      `;

      const allTransactions = [...revenues, ...expenses];

      let cashRevenue = 0;
      let bankRevenue = 0;
      let cashExpenses = 0;
      let bankExpenses = 0;

      allTransactions.forEach((tx: any) => {
        const amount = parseInt(tx.amount_cents) || 0;
        if (tx.type === 'revenue') {
          if (tx.payment_mode === 'cash') {
            cashRevenue += amount;
          } else {
            bankRevenue += amount;
          }
        } else {
          if (tx.payment_mode === 'cash') {
            cashExpenses += amount;
          } else {
            bankExpenses += amount;
          }
        }
      });

      // Get opening balance to calculate closing
      const balanceRecord = await reportsDB.queryRow`
        SELECT opening_balance_cents
        FROM daily_cash_balances
        WHERE property_id = ${propertyId}
          AND org_id = ${authData.orgId}
          AND balance_date = ${date}::date
      `;

      const opening = balanceRecord ? parseInt(balanceRecord.opening_balance_cents) : 0;
      const calculatedClosing = opening + cashRevenue - cashExpenses;

      return {
        transactions: allTransactions.map((tx: any) => ({
          type: tx.type,
          amountCents: parseInt(tx.amount_cents),
          paymentMode: tx.payment_mode,
          category: tx.category,
          status: tx.status,
          createdAt: tx.created_at,
        })),
        summary: {
          cashRevenue,
          bankRevenue,
          cashExpenses,
          bankExpenses,
          calculatedClosing,
        },
      };
    } catch (error) {
      console.error('Get date transactions error:', error);
      throw APIError.internal("Failed to get transactions");
    }
}

// LEGACY: Get transactions for a specific date (keep for backward compatibility)
export const getDateTransactions = api<{
  propertyId: number;
  date: string;
}, {
  transactions: Array<{
    type: 'revenue' | 'expense';
    amountCents: number;
    paymentMode: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  summary: {
    cashRevenue: number;
    bankRevenue: number;
    cashExpenses: number;
    bankExpenses: number;
    calculatedClosing: number;
  };
}>(
  { auth: true, expose: true, method: "GET", path: "/reports/date-transactions" },
  getDateTransactionsHandler
);

// V1: Get transactions for a specific date
export const getDateTransactionsV1 = api<{
  propertyId: number;
  date: string;
}, {
  transactions: Array<{
    type: 'revenue' | 'expense';
    amountCents: number;
    paymentMode: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  summary: {
    cashRevenue: number;
    bankRevenue: number;
    cashExpenses: number;
    bankExpenses: number;
    calculatedClosing: number;
  };
}>(
  { auth: true, expose: true, method: "GET", path: "/v1/reports/date-transactions" },
  getDateTransactionsHandler
);

