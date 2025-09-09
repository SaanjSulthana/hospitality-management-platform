import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

// Debug endpoint to check transaction data and daily report logic
export const debugDailyReport = api<{
  date: string;
  propertyId?: number;
}, {
  debugInfo: {
    date: string;
    propertyId?: number;
    orgId: number;
    transactions: any[];
    cashBalance: any;
    revenueQuery: string;
    expenseQuery: string;
    balanceQuery: string;
  }
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/debug-daily-report" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { date, propertyId } = req;

    try {
      console.log(`=== DEBUG: Daily Report for ${date} ===`);
      console.log('Auth data:', { orgId: authData.orgId, userId: authData.userID, role: authData.role });
      console.log('Request params:', { date, propertyId });
      
      // First, let's test if we can find ANY transactions at all
      console.log('=== DEBUG: Testing basic transaction queries ===');
      const testRevenues = await reportsDB.rawQueryAll(
        `SELECT r.id, r.amount_cents, r.occurred_at, r.status, p.name as property_name
         FROM revenues r
         JOIN properties p ON r.property_id = p.id
         WHERE r.org_id = $1
         ORDER BY r.occurred_at DESC
         LIMIT 5`,
        authData.orgId
      );
      console.log('Test revenues (any date):', testRevenues);
      
      const testExpenses = await reportsDB.rawQueryAll(
        `SELECT e.id, e.amount_cents, e.expense_date, e.status, p.name as property_name
         FROM expenses e
         JOIN properties p ON e.property_id = p.id
         WHERE e.org_id = $1
         ORDER BY e.expense_date DESC
         LIMIT 5`,
        authData.orgId
      );
      console.log('Test expenses (any date):', testExpenses);

      // Build property filter
      let propertyFilter = '';
      let propertyParams: any[] = [];
      
      if (authData.role === "MANAGER") {
        propertyFilter = `AND p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $1
        )`;
        propertyParams.push(parseInt(authData.userID));
      }

      if (propertyId) {
        propertyFilter += ` AND p.id = $${propertyParams.length + 1}`;
        propertyParams.push(propertyId);
      }

      // Check all revenues for the date (including pending) - using date range like Finance system
      const allRevenuesQuery = `
        SELECT 
          r.id, r.amount_cents, r.payment_mode, r.status, r.source,
          r.occurred_at, p.name as property_name, u.display_name as created_by_name
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1} 
          AND r.occurred_at >= $${propertyParams.length + 2}::date 
          AND r.occurred_at < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
          ${propertyFilter}
        ORDER BY r.occurred_at DESC
      `;

      console.log('=== DEBUG: All Revenues Query ===');
      console.log('Query:', allRevenuesQuery);
      console.log('Params:', [...propertyParams, authData.orgId, date]);
      
      const allRevenues = await reportsDB.rawQueryAll(
        allRevenuesQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );
      
      console.log('All revenues result:', allRevenues);

      // Check all expenses for the date (including pending) - using date range like Finance system
      const allExpensesQuery = `
        SELECT 
          e.id, e.amount_cents, e.payment_mode, e.status, e.category,
          e.expense_date as occurred_at, p.name as property_name, u.display_name as created_by_name
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.org_id = $${propertyParams.length + 1} 
          AND e.expense_date >= $${propertyParams.length + 2}::date 
          AND e.expense_date < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
          ${propertyFilter}
        ORDER BY e.expense_date DESC
      `;

      console.log('=== DEBUG: All Expenses Query ===');
      console.log('Query:', allExpensesQuery);
      console.log('Params:', [...propertyParams, authData.orgId, date]);
      
      const allExpenses = await reportsDB.rawQueryAll(
        allExpensesQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );
      
      console.log('All expenses result:', allExpenses);

      // Check approved revenues only - using date range like Finance system
      const approvedRevenuesQuery = `
        SELECT 
          r.id, r.amount_cents, r.payment_mode, r.status, r.source,
          r.occurred_at, p.name as property_name, u.display_name as created_by_name
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1} 
          AND r.occurred_at >= $${propertyParams.length + 2}::date 
          AND r.occurred_at < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
          AND r.status = 'approved'
          ${propertyFilter}
        ORDER BY r.occurred_at DESC
      `;

      const approvedRevenues = await reportsDB.rawQueryAll(
        approvedRevenuesQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );

      // Check approved expenses only - using date range like Finance system
      const approvedExpensesQuery = `
        SELECT 
          e.id, e.amount_cents, e.payment_mode, e.status, e.category,
          e.expense_date as occurred_at, p.name as property_name, u.display_name as created_by_name
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.org_id = $${propertyParams.length + 1} 
          AND e.expense_date >= $${propertyParams.length + 2}::date 
          AND e.expense_date < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
          AND e.status = 'approved'
          ${propertyFilter}
        ORDER BY e.expense_date DESC
      `;

      const approvedExpenses = await reportsDB.rawQueryAll(
        approvedExpensesQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );

      // Check cash balance
      const cashBalanceQuery = `
        SELECT 
          dcb.id, dcb.property_id, p.name as property_name, dcb.balance_date,
          dcb.opening_balance_cents, dcb.cash_received_cents, dcb.bank_received_cents,
          dcb.cash_expenses_cents, dcb.bank_expenses_cents, dcb.closing_balance_cents,
          dcb.created_at, dcb.updated_at
        FROM daily_cash_balances dcb
        JOIN properties p ON dcb.property_id = p.id
        WHERE dcb.org_id = $${propertyParams.length + 1} 
          AND dcb.balance_date = $${propertyParams.length + 2}
          ${propertyFilter}
        ORDER BY p.name
      `;

      const cashBalance = await reportsDB.rawQueryRow(
        cashBalanceQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );

      console.log('=== DEBUG RESULTS ===');
      console.log('All revenues:', allRevenues.length, allRevenues);
      console.log('All expenses:', allExpenses.length, allExpenses);
      console.log('Approved revenues:', approvedRevenues.length, approvedRevenues);
      console.log('Approved expenses:', approvedExpenses.length, approvedExpenses);
      console.log('Cash balance:', cashBalance);

      // Combine all transactions for display
      const allTransactions = [
        ...allRevenues.map((r: any) => ({ ...r, type: 'revenue' })),
        ...allExpenses.map((e: any) => ({ ...e, type: 'expense' }))
      ];

      return {
        debugInfo: {
          date,
          propertyId,
          orgId: authData.orgId,
          transactions: allTransactions,
          cashBalance,
          revenueQuery: allRevenuesQuery,
          expenseQuery: allExpensesQuery,
          balanceQuery: cashBalanceQuery,
        }
      };
    } catch (error) {
      console.error('Debug daily report error:', error);
      throw APIError.internal("Failed to debug daily report");
    }
  }
);
