import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { v1Path } from "../shared/http";
import { trackMetrics } from "../middleware";

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
async function getFinancialSummaryHandler(req: FinancialSummaryRequest): Promise<FinancialSummaryResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    
    // Wrap with metrics tracking for P0 baseline capture
    return trackMetrics('/v1/finance/summary', async (timer) => {
      timer.checkpoint('auth');
      requireRole("ADMIN", "MANAGER")(authData);

      const { propertyId, startDate, endDate } = req || {};

      try {
        timer.checkpoint('db_start');
        // Get revenue summary by payment mode
      let revenueQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN r.payment_mode = 'cash' THEN r.amount_cents ELSE 0 END), 0)::text as cash_revenue,
          COALESCE(SUM(CASE WHEN r.payment_mode = 'bank' THEN r.amount_cents ELSE 0 END), 0)::text as bank_revenue,
          COALESCE(SUM(r.amount_cents), 0)::text as total_revenue,
          COUNT(CASE WHEN r.payment_mode = 'cash' THEN 1 END)::text as cash_count,
          COUNT(CASE WHEN r.payment_mode = 'bank' THEN 1 END)::text as bank_count,
          COUNT(*)::text as total_count
        FROM revenues r
        WHERE r.org_id = $1
      `;
      
      let revenueParams = [authData.orgId];
      let paramIndex = 2;
      
      if (propertyId) {
        revenueQuery += ` AND r.property_id = $${paramIndex}`;
        revenueParams.push(propertyId);
        paramIndex++;
      }
      
      if (startDate) {
        revenueQuery += ` AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $${paramIndex}`;
        revenueParams.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        revenueQuery += ` AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $${paramIndex}`;
        revenueParams.push(endDate);
        paramIndex++;
      }
      
      if (authData.role === "MANAGER") {
        revenueQuery += ` AND r.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})`;
        revenueParams.push(parseInt(authData.userID));
        paramIndex++;
      }
      
      const revenueResult = await financeDB.rawQueryRow(revenueQuery, ...revenueParams);
      console.log('Revenue result:', revenueResult);
      const revenueSummary = revenueResult;

      // Get expense summary by payment mode
      let expenseQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN e.payment_mode = 'cash' THEN e.amount_cents ELSE 0 END), 0)::text as cash_expenses,
          COALESCE(SUM(CASE WHEN e.payment_mode = 'bank' THEN e.amount_cents ELSE 0 END), 0)::text as bank_expenses,
          COALESCE(SUM(e.amount_cents), 0)::text as total_expenses,
          COUNT(CASE WHEN e.payment_mode = 'cash' THEN 1 END)::text as cash_count,
          COUNT(CASE WHEN e.payment_mode = 'bank' THEN 1 END)::text as bank_count,
          COUNT(*)::text as total_count
        FROM expenses e
        WHERE e.org_id = $1
      `;
      
      let expenseParams = [authData.orgId];
      let expenseParamIndex = 2;
      
      if (propertyId) {
        expenseQuery += ` AND e.property_id = $${expenseParamIndex}`;
        expenseParams.push(propertyId);
        expenseParamIndex++;
      }
      
      if (startDate) {
        expenseQuery += ` AND e.expense_date >= $${expenseParamIndex}`;
        expenseParams.push(startDate);
        expenseParamIndex++;
      }
      
      if (endDate) {
        expenseQuery += ` AND e.expense_date <= $${expenseParamIndex}`;
        expenseParams.push(endDate);
        expenseParamIndex++;
      }
      
      if (authData.role === "MANAGER") {
        expenseQuery += ` AND e.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${expenseParamIndex})`;
        expenseParams.push(parseInt(authData.userID));
        expenseParamIndex++;
      }
      
      const expenseResult = await financeDB.rawQueryRow(expenseQuery, ...expenseParams);
      console.log('Expense result:', expenseResult);
      const expenseSummary = expenseResult;

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

        timer.checkpoint('db_complete');
        
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
    }); // End trackMetrics
}

export const getFinancialSummary = api<FinancialSummaryRequest, FinancialSummaryResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/summary" },
  getFinancialSummaryHandler
);

export const getFinancialSummaryV1 = api<FinancialSummaryRequest, FinancialSummaryResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/summary" },
  getFinancialSummaryHandler
);

