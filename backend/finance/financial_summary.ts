import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface FinancialSummaryRequest {
  propertyId?: number;
  startDate?: string;
  endDate?: string;
}

export interface FinancialSummaryResponse {
  success: boolean;
  summary: {
    totalRevenue: {
      cash: number;
      bank: number;
      total: number;
    };
    totalExpenses: {
      cash: number;
      bank: number;
      total: number;
    };
    netIncome: {
      cash: number;
      bank: number;
      total: number;
    };
    transactionCounts: {
      revenue: {
        cash: number;
        bank: number;
        total: number;
      };
      expenses: {
        cash: number;
        bank: number;
        total: number;
      };
    };
  };
  period: {
    startDate?: string;
    endDate?: string;
    propertyId?: number;
  };
}

// Get comprehensive financial summary with payment mode breakdown
export const getFinancialSummary = api<FinancialSummaryRequest, FinancialSummaryResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/summary" },
  async (req) => {
    console.log('=== GETTING FINANCIAL SUMMARY ===');
    console.log('Request:', req);
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate } = req || {};

    try {
      // Build base query conditions
      let whereConditions = ['r.org_id = $1'];
      let params: any[] = [authData.orgId];
      let paramIndex = 2;

      if (propertyId) {
        whereConditions.push(`r.property_id = $${paramIndex}`);
        params.push(propertyId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`r.occurred_at >= $${paramIndex}`);
        params.push(new Date(`${startDate}T00:00:00.000Z`));
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`r.occurred_at <= $${paramIndex}`);
        params.push(new Date(`${endDate}T23:59:59.999Z`));
        paramIndex++;
      }

      // Managers can only see data for properties they have access to
      if (authData.role === "MANAGER") {
        whereConditions.push(`r.property_id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )`);
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get revenue summary by payment mode
      const revenueSummary = await financeDB.queryRow`
        SELECT 
          COALESCE(SUM(CASE WHEN r.payment_mode = 'cash' THEN r.amount_cents ELSE 0 END), 0) as cash_revenue,
          COALESCE(SUM(CASE WHEN r.payment_mode = 'bank' THEN r.amount_cents ELSE 0 END), 0) as bank_revenue,
          COALESCE(SUM(r.amount_cents), 0) as total_revenue,
          COUNT(CASE WHEN r.payment_mode = 'cash' THEN 1 END) as cash_count,
          COUNT(CASE WHEN r.payment_mode = 'bank' THEN 1 END) as bank_count,
          COUNT(*) as total_count
        FROM revenues r
        WHERE ${whereClause}
      `;

      // Get expense summary by payment mode
      const expenseSummary = await financeDB.queryRow`
        SELECT 
          COALESCE(SUM(CASE WHEN e.payment_mode = 'cash' THEN e.amount_cents ELSE 0 END), 0) as cash_expenses,
          COALESCE(SUM(CASE WHEN e.payment_mode = 'bank' THEN e.amount_cents ELSE 0 END), 0) as bank_expenses,
          COALESCE(SUM(e.amount_cents), 0) as total_expenses,
          COUNT(CASE WHEN e.payment_mode = 'cash' THEN 1 END) as cash_count,
          COUNT(CASE WHEN e.payment_mode = 'bank' THEN 1 END) as bank_count,
          COUNT(*) as total_count
        FROM expenses e
        WHERE e.org_id = $1 ${propertyId ? `AND e.property_id = $${paramIndex}` : ''} ${startDate ? `AND e.expense_date >= $${paramIndex + (propertyId ? 1 : 0)}` : ''} ${endDate ? `AND e.expense_date <= $${paramIndex + (propertyId ? 1 : 0) + (startDate ? 1 : 0)}` : ''}
        ${authData.role === "MANAGER" ? `AND e.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex + (propertyId ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)})` : ''}
      `;

      console.log('Revenue summary:', revenueSummary);
      console.log('Expense summary:', expenseSummary);

      const summary = {
        totalRevenue: {
          cash: parseInt(revenueSummary.cash_revenue) || 0,
          bank: parseInt(revenueSummary.bank_revenue) || 0,
          total: parseInt(revenueSummary.total_revenue) || 0,
        },
        totalExpenses: {
          cash: parseInt(expenseSummary.cash_expenses) || 0,
          bank: parseInt(expenseSummary.bank_expenses) || 0,
          total: parseInt(expenseSummary.total_expenses) || 0,
        },
        netIncome: {
          cash: (parseInt(revenueSummary.cash_revenue) || 0) - (parseInt(expenseSummary.cash_expenses) || 0),
          bank: (parseInt(revenueSummary.bank_revenue) || 0) - (parseInt(expenseSummary.bank_expenses) || 0),
          total: (parseInt(revenueSummary.total_revenue) || 0) - (parseInt(expenseSummary.total_expenses) || 0),
        },
        transactionCounts: {
          revenue: {
            cash: parseInt(revenueSummary.cash_count) || 0,
            bank: parseInt(revenueSummary.bank_count) || 0,
            total: parseInt(revenueSummary.total_count) || 0,
          },
          expenses: {
            cash: parseInt(expenseSummary.cash_count) || 0,
            bank: parseInt(expenseSummary.bank_count) || 0,
            total: parseInt(expenseSummary.total_count) || 0,
          },
        },
      };

      return {
        success: true,
        summary,
        period: {
          startDate,
          endDate,
          propertyId,
        },
      };
    } catch (error) {
      console.error('Error getting financial summary:', error);
      throw APIError.internal(`Failed to get financial summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

