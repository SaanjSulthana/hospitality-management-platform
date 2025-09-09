import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

// Debug endpoint to check ALL transactions in the database
export const debugAllTransactions = api<{
  orgId?: number;
  propertyId?: number;
  limit?: number;
}, {
  debugInfo: {
    orgId: number;
    totalRevenues: number;
    totalExpenses: number;
    recentRevenues: any[];
    recentExpenses: any[];
    revenuesByDate: Record<string, any[]>;
    expensesByDate: Record<string, any[]>;
    allDates: string[];
  }
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/debug-all-transactions" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { orgId = authData.orgId, propertyId, limit = 50 } = req;

    try {
      console.log(`=== DEBUG: All Transactions for Org ${orgId} ===`);

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

      // Get all revenues
      const allRevenuesQuery = `
        SELECT 
          r.id, r.amount_cents, r.payment_mode, r.status, r.source,
          r.occurred_at, p.name as property_name, u.display_name as created_by_name,
          DATE(r.occurred_at) as transaction_date
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1}
          ${propertyFilter}
        ORDER BY r.occurred_at DESC
        LIMIT ${limit}
      `;

      const allRevenues = await reportsDB.rawQueryAll(
        allRevenuesQuery, 
        ...propertyParams, 
        orgId
      );

      // Get all expenses
      const allExpensesQuery = `
        SELECT 
          e.id, e.amount_cents, e.payment_mode, e.status, e.category,
          e.expense_date as occurred_at, p.name as property_name, u.display_name as created_by_name,
          DATE(e.expense_date) as transaction_date
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.org_id = $${propertyParams.length + 1}
          ${propertyFilter}
        ORDER BY e.expense_date DESC
        LIMIT ${limit}
      `;

      const allExpenses = await reportsDB.rawQueryAll(
        allExpensesQuery, 
        ...propertyParams, 
        orgId
      );

      // Get total counts
      const totalRevenuesQuery = `
        SELECT COUNT(*) as count
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        WHERE r.org_id = $${propertyParams.length + 1}
          ${propertyFilter}
      `;

      const totalExpensesQuery = `
        SELECT COUNT(*) as count
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        WHERE e.org_id = $${propertyParams.length + 1}
          ${propertyFilter}
      `;

      const totalRevenuesResult = await reportsDB.rawQueryRow(totalRevenuesQuery, ...propertyParams, orgId);
      const totalExpensesResult = await reportsDB.rawQueryRow(totalExpensesQuery, ...propertyParams, orgId);

      // Group by date
      const revenuesByDate: Record<string, any[]> = {};
      const expensesByDate: Record<string, any[]> = {};
      const allDates = new Set<string>();

      allRevenues.forEach((r: any) => {
        const date = r.transaction_date;
        if (!revenuesByDate[date]) {
          revenuesByDate[date] = [];
        }
        revenuesByDate[date].push(r);
        allDates.add(date);
      });

      allExpenses.forEach((e: any) => {
        const date = e.transaction_date;
        if (!expensesByDate[date]) {
          expensesByDate[date] = [];
        }
        expensesByDate[date].push(e);
        allDates.add(date);
      });

      console.log('=== DEBUG RESULTS ===');
      console.log('Total revenues:', totalRevenuesResult?.count || 0);
      console.log('Total expenses:', totalExpensesResult?.count || 0);
      console.log('Recent revenues:', allRevenues.length, allRevenues);
      console.log('Recent expenses:', allExpenses.length, allExpenses);
      console.log('Dates with transactions:', Array.from(allDates).sort());

      return {
        debugInfo: {
          orgId,
          totalRevenues: parseInt(totalRevenuesResult?.count || '0'),
          totalExpenses: parseInt(totalExpensesResult?.count || '0'),
          recentRevenues: allRevenues,
          recentExpenses: allExpenses,
          revenuesByDate,
          expensesByDate,
          allDates: Array.from(allDates).sort(),
        }
      };
    } catch (error) {
      console.error('Debug all transactions error:', error);
      throw APIError.internal("Failed to debug all transactions");
    }
  }
);
