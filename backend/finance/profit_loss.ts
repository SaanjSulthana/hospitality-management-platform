import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface ProfitLossRequest {
  propertyId?: Query<number>;
  startDate?: Query<Date>;
  endDate?: Query<Date>;
}

export interface ProfitLossData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  revenueBySource: {
    room: number;
    addon: number;
    other: number;
  };
  expensesByCategory: Record<string, number>;
}

export interface ProfitLossResponse {
  data: ProfitLossData;
  period: {
    startDate: Date;
    endDate: Date;
  };
  propertyId?: number;
  propertyName?: string;
}

// Gets profit and loss statement
export const profitLoss = api<ProfitLossRequest, ProfitLossResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/profit-loss" },
  async (req) => {
    const authData = getAuthData()!;
    const { propertyId, startDate, endDate } = req;

    try {
      // Default to current month if no date range provided
      const defaultEndDate = new Date();
      const defaultStartDate = new Date(defaultEndDate.getFullYear(), defaultEndDate.getMonth(), 1);

      const periodStart = startDate || defaultStartDate;
      const periodEnd = endDate || defaultEndDate;

      // Build property filter
      let propertyFilter = "";
      const params: any[] = [authData.orgId, periodStart, periodEnd];
      let paramIndex = 4;

      if (propertyId) {
        propertyFilter += ` AND p.id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (authData.role === "MANAGER") {
        propertyFilter += ` AND p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Get revenue data
      const revenueQuery = `
        SELECT 
          COALESCE(SUM(r.amount_cents), 0) as total_revenue_cents,
          COALESCE(SUM(CASE WHEN r.source = 'room' THEN r.amount_cents ELSE 0 END), 0) as room_revenue_cents,
          COALESCE(SUM(CASE WHEN r.source = 'addon' THEN r.amount_cents ELSE 0 END), 0) as addon_revenue_cents,
          COALESCE(SUM(CASE WHEN r.source = 'other' THEN r.amount_cents ELSE 0 END), 0) as other_revenue_cents
        FROM properties p
        LEFT JOIN revenues r ON p.id = r.property_id AND r.org_id = $1 AND r.occurred_at BETWEEN $2 AND $3
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      const revenueData = await financeDB.rawQueryRow(revenueQuery, ...params);

      // Get expense data by category
      const expenseQuery = `
        SELECT 
          e.category,
          COALESCE(SUM(e.amount_cents), 0) as category_amount_cents
        FROM properties p
        LEFT JOIN expenses e ON p.id = e.property_id AND e.org_id = $1 AND e.expense_date BETWEEN $2 AND $3 AND e.status = 'approved'
        WHERE p.org_id = $1 ${propertyFilter} AND e.category IS NOT NULL
        GROUP BY e.category
      `;

      const expenseData = await financeDB.rawQueryAll(expenseQuery, ...params);

      // Get total expenses
      const totalExpensesQuery = `
        SELECT COALESCE(SUM(e.amount_cents), 0) as total_expenses_cents
        FROM properties p
        LEFT JOIN expenses e ON p.id = e.property_id AND e.org_id = $1 AND e.expense_date BETWEEN $2 AND $3 AND e.status = 'approved'
        WHERE p.org_id = $1 ${propertyFilter}
      `;

      const totalExpensesData = await financeDB.rawQueryRow(totalExpensesQuery, ...params);

      // Get property name if specific property requested
      let propertyName: string | undefined;
      if (propertyId) {
        const propertyRow = await financeDB.queryRow`
          SELECT name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;
        propertyName = propertyRow?.name;
      }

      // Calculate metrics
      const totalRevenue = (parseInt(revenueData?.total_revenue_cents) || 0) / 100;
      const totalExpenses = (parseInt(totalExpensesData?.total_expenses_cents) || 0) / 100;
      const netIncome = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

      const revenueBySource = {
        room: (parseInt(revenueData?.room_revenue_cents) || 0) / 100,
        addon: (parseInt(revenueData?.addon_revenue_cents) || 0) / 100,
        other: (parseInt(revenueData?.other_revenue_cents) || 0) / 100,
      };

      const expensesByCategory: Record<string, number> = {};
      expenseData.forEach(expense => {
        if (expense.category) {
          expensesByCategory[expense.category] = (parseInt(expense.category_amount_cents) || 0) / 100;
        }
      });

      return {
        data: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netIncome: Math.round(netIncome * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          revenueBySource,
          expensesByCategory,
        },
        period: {
          startDate: periodStart,
          endDate: periodEnd,
        },
        propertyId,
        propertyName,
      };
    } catch (error) {
      console.error('Profit loss error:', error);
      throw new Error('Failed to fetch profit and loss data');
    }
  }
);
