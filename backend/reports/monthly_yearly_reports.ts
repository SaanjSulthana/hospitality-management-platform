import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";

interface MonthlyYearlyReportRequest {
  propertyId?: number;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  includePending?: boolean; // Include pending transactions
}

export interface MonthlyYearlyReportData {
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

export interface MonthlyYearlyReportResponse {
  data: MonthlyYearlyReportData;
  period: {
    startDate: Date;
    endDate: Date;
  };
  propertyId?: number;
  propertyName?: string;
}

// Gets profit and loss statement for monthly/yearly reports
export const getMonthlyYearlyReport = api<MonthlyYearlyReportRequest, MonthlyYearlyReportResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/monthly-yearly-report" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate, includePending = true } = req || {};

    console.log('=== DEBUG: Monthly/Yearly Report Request ===');
    console.log('Property ID:', propertyId);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Include Pending:', includePending);
    console.log('Org ID:', authData.orgId);

    try {
      // Default to current month if no date range provided
      const now = new Date();
      const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
      const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

      const periodStart = startDate ? new Date(`${startDate}T00:00:00.000Z`) : defaultStartDate;
      const periodEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`) : defaultEndDate;

      console.log('=== DEBUG: Date Range Processing ===');
      console.log('Period Start:', periodStart.toISOString());
      console.log('Period End:', periodEnd.toISOString());

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

      // Get revenue data with safe parsing - use CAST to convert NUMERIC to INTEGER
      let revenueData;
      try {
        const revenueQuery = `
          SELECT 
            COALESCE(SUM(CAST(r.amount_cents AS INTEGER)), 0) as total_revenue_cents,
            COALESCE(SUM(CASE WHEN r.source = 'room' THEN CAST(r.amount_cents AS INTEGER) ELSE 0 END), 0) as room_revenue_cents,
            COALESCE(SUM(CASE WHEN r.source = 'addon' THEN CAST(r.amount_cents AS INTEGER) ELSE 0 END), 0) as addon_revenue_cents,
            COALESCE(SUM(CASE WHEN r.source = 'other' THEN CAST(r.amount_cents AS INTEGER) ELSE 0 END), 0) as other_revenue_cents
          FROM revenues r
          JOIN properties p ON r.property_id = p.id
          WHERE r.org_id = $1 
            AND p.org_id = $1
            AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= DATE($2::timestamptz AT TIME ZONE 'Asia/Kolkata') 
            AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= DATE($3::timestamptz AT TIME ZONE 'Asia/Kolkata')
            ${propertyFilter}
        `;
        
        const result = await reportsDB.rawQueryRow(revenueQuery, ...params);
        
        console.log('=== DEBUG: Revenue calculation ===');
        console.log('Revenue query result:', result);
        console.log('Params:', params);
        console.log('Period start:', periodStart);
        console.log('Period end:', periodEnd);
        console.log('Include pending:', includePending);
        
        revenueData = {
          totalRevenueCents: parseInt(result?.total_revenue_cents || '0'),
          roomRevenueCents: parseInt(result?.room_revenue_cents || '0'),
          addonRevenueCents: parseInt(result?.addon_revenue_cents || '0'),
          otherRevenueCents: parseInt(result?.other_revenue_cents || '0'),
        };
      } catch (error) {
        console.error('Revenue query error:', error);
        revenueData = {
          totalRevenueCents: 0,
          roomRevenueCents: 0,
          addonRevenueCents: 0,
          otherRevenueCents: 0,
        };
      }

      // Get expenses data with safe parsing
      let expensesData;
      try {
        const expensesQuery = `
          SELECT 
            COALESCE(SUM(CAST(e.amount_cents AS INTEGER)), 0) as total_expenses_cents,
            e.category,
            COALESCE(SUM(CAST(e.amount_cents AS INTEGER)), 0) as category_total_cents
          FROM expenses e
          JOIN properties p ON e.property_id = p.id
          WHERE e.org_id = $1 
            AND p.org_id = $1
            AND e.expense_date >= DATE($2::timestamptz AT TIME ZONE 'Asia/Kolkata') 
            AND e.expense_date <= DATE($3::timestamptz AT TIME ZONE 'Asia/Kolkata')
            ${propertyFilter}
          GROUP BY e.category
          ORDER BY category_total_cents DESC
        `;
        
        const result = await reportsDB.rawQueryAll(expensesQuery, ...params);
        
        console.log('=== DEBUG: Expenses calculation ===');
        console.log('Expenses query result:', result);
        
        const totalExpensesCents = parseInt(result?.reduce((sum: any, row: any) => 
          sum + parseInt(row.total_expenses_cents || '0'), 0) || '0');
        
        const expensesByCategory: Record<string, number> = {};
        result?.forEach((row: any) => {
          const category = row.category || 'other';
          expensesByCategory[category] = parseInt(row.category_total_cents || '0');
        });
        
        expensesData = {
          totalExpensesCents,
          expensesByCategory,
        };
      } catch (error) {
        console.error('Expenses query error:', error);
        expensesData = {
          totalExpensesCents: 0,
          expensesByCategory: {},
        };
      }

      // Calculate profit and loss
      const totalRevenue = revenueData.totalRevenueCents / 100; // Convert cents to dollars
      const totalExpenses = expensesData.totalExpensesCents / 100;
      const netIncome = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

      // Get property name if propertyId is specified
      let propertyName: string | undefined;
      if (propertyId) {
        try {
          const propertyResult = await reportsDB.queryRow`
            SELECT name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
          `;
          propertyName = propertyResult?.name;
        } catch (error) {
          console.error('Property name query error:', error);
        }
      }

      return {
        data: {
          totalRevenue,
          totalExpenses,
          netIncome,
          profitMargin,
          revenueBySource: {
            room: revenueData.roomRevenueCents / 100,
            addon: revenueData.addonRevenueCents / 100,
            other: revenueData.otherRevenueCents / 100,
          },
          expensesByCategory: Object.fromEntries(
            Object.entries(expensesData.expensesByCategory).map(([key, value]) => [
              key, 
              value / 100
            ])
          ),
        },
        period: {
          startDate: periodStart,
          endDate: periodEnd,
        },
        propertyId,
        propertyName,
      };
    } catch (error) {
      console.error('Get monthly/yearly report error:', error);
      throw APIError.internal("Failed to get monthly/yearly report");
    }
  }
);

// Get monthly summary report
export const getMonthlySummary = api<{
  year: string;
  month: string;
  propertyId?: number;
}, {
  month: string;
  year: string;
  propertyId?: number;
  propertyName?: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  daysWithTransactions: number;
  totalDays: number;
  averageDailyRevenue: number;
  averageDailyExpenses: number;
}>({
  auth: true, expose: true, method: "GET", path: "/reports/monthly-summary"
}, async (req) => {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { year, month, propertyId } = req;

    try {
    // Create date range in IST timezone
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    // Build property filter
    let propertyFilter = "";
    const params: any[] = [authData.orgId, startDate, endDate];
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

    // Get revenue summary
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(CAST(r.amount_cents AS INTEGER)), 0) as total_revenue_cents,
        COUNT(DISTINCT DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata')) as days_with_revenue
      FROM revenues r
      JOIN properties p ON r.property_id = p.id
      WHERE r.org_id = $1 
        AND p.org_id = $1
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $2::date 
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $3::date
        ${propertyFilter}
    `;

    const revenueResult = await reportsDB.rawQueryRow(revenueQuery, ...params);

    // Get expenses summary
    const expensesQuery = `
      SELECT 
        COALESCE(SUM(CAST(e.amount_cents AS INTEGER)), 0) as total_expenses_cents,
        COUNT(DISTINCT e.expense_date) as days_with_expenses
      FROM expenses e
      JOIN properties p ON e.property_id = p.id
      WHERE e.org_id = $1 
        AND p.org_id = $1
        AND e.expense_date >= $2::date AND e.expense_date <= $3::date
        ${propertyFilter}
    `;

    const expensesResult = await reportsDB.rawQueryRow(expensesQuery, ...params);

    // Calculate totals
    const totalRevenue = parseInt(revenueResult?.total_revenue_cents || '0') / 100;
    const totalExpenses = parseInt(expensesResult?.total_expenses_cents || '0') / 100;
    const netIncome = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    // Calculate days with transactions
    const daysWithRevenue = parseInt(revenueResult?.days_with_revenue || '0');
    const daysWithExpenses = parseInt(expensesResult?.days_with_expenses || '0');
    const daysWithTransactions = Math.max(daysWithRevenue, daysWithExpenses);

    // Get total days in month
    const totalDays = new Date(parseInt(year), parseInt(month), 0).getDate();

    // Calculate averages
    const averageDailyRevenue = daysWithTransactions > 0 ? totalRevenue / daysWithTransactions : 0;
    const averageDailyExpenses = daysWithTransactions > 0 ? totalExpenses / daysWithTransactions : 0;

    // Get property name if propertyId is specified
    let propertyName: string | undefined;
    if (propertyId) {
      try {
        const propertyResult = await reportsDB.queryRow`
          SELECT name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;
        propertyName = propertyResult?.name;
      } catch (error) {
        console.error('Property name query error:', error);
      }
    }

    return {
      month,
      year,
      propertyId,
      propertyName,
      totalRevenue,
      totalExpenses,
      netIncome,
      profitMargin,
      daysWithTransactions,
      totalDays,
      averageDailyRevenue,
      averageDailyExpenses,
    };
  } catch (error) {
    console.error('Get monthly summary error:', error);
    throw APIError.internal("Failed to get monthly summary");
  }
});

// Get yearly summary report
export const getYearlySummary = api<{
  year: string;
  propertyId?: number;
}, {
  year: string;
  propertyId?: number;
  propertyName?: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  monthsWithTransactions: number;
  totalMonths: number;
  averageMonthlyRevenue: number;
  averageMonthlyExpenses: number;
  monthlyBreakdown: Array<{
    month: string;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>;
}>({
  auth: true, expose: true, method: "GET", path: "/reports/yearly-summary"
}, async (req) => {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { year, propertyId } = req;

  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Build property filter
    let propertyFilter = "";
    const params: any[] = [authData.orgId, startDate, endDate];
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

    // Get monthly revenue breakdown
    const revenueQuery = `
      SELECT 
        CAST(EXTRACT(MONTH FROM r.occurred_at AT TIME ZONE 'Asia/Kolkata') AS INTEGER) as month,
        COALESCE(SUM(CAST(r.amount_cents AS INTEGER)), 0) as total_revenue_cents
      FROM revenues r
      JOIN properties p ON r.property_id = p.id
      WHERE r.org_id = $1 
        AND p.org_id = $1
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $2::date 
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $3::date
        ${propertyFilter}
      GROUP BY EXTRACT(MONTH FROM r.occurred_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY month
    `;

    const revenueResults = await reportsDB.rawQueryAll(revenueQuery, ...params);

    // Get monthly expenses breakdown
    const expensesQuery = `
      SELECT 
        CAST(EXTRACT(MONTH FROM e.expense_date) AS INTEGER) as month,
        COALESCE(SUM(CAST(e.amount_cents AS INTEGER)), 0) as total_expenses_cents
      FROM expenses e
      JOIN properties p ON e.property_id = p.id
      WHERE e.org_id = $1 
        AND p.org_id = $1
        AND e.expense_date >= $2::date AND e.expense_date <= $3::date
        ${propertyFilter}
      GROUP BY EXTRACT(MONTH FROM e.expense_date)
      ORDER BY month
    `;

    const expensesResults = await reportsDB.rawQueryAll(expensesQuery, ...params);

    // Create monthly breakdown
    const monthlyBreakdown = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let totalRevenue = 0;
    let totalExpenses = 0;
    let monthsWithTransactions = 0;

    for (let month = 1; month <= 12; month++) {
      const monthRevenue = revenueResults.find((r: any) => parseInt(r.month) === month);
      const monthExpenses = expensesResults.find((e: any) => parseInt(e.month) === month);
      
      const revenue = monthRevenue ? parseInt(monthRevenue.total_revenue_cents) / 100 : 0;
      const expenses = monthExpenses ? parseInt(monthExpenses.total_expenses_cents) / 100 : 0;
      const netIncome = revenue - expenses;

      if (revenue > 0 || expenses > 0) {
        monthsWithTransactions++;
      }

      totalRevenue += revenue;
      totalExpenses += expenses;

      monthlyBreakdown.push({
        month: monthNames[month - 1],
        revenue,
        expenses,
        netIncome,
      });
    }

    const netIncome = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const averageMonthlyRevenue = monthsWithTransactions > 0 ? totalRevenue / monthsWithTransactions : 0;
    const averageMonthlyExpenses = monthsWithTransactions > 0 ? totalExpenses / monthsWithTransactions : 0;

    // Get property name if propertyId is specified
    let propertyName: string | undefined;
    if (propertyId) {
      try {
        const propertyResult = await reportsDB.queryRow`
          SELECT name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;
        propertyName = propertyResult?.name;
      } catch (error) {
        console.error('Property name query error:', error);
      }
    }

    return {
      year,
      propertyId,
      propertyName,
      totalRevenue,
      totalExpenses,
      netIncome,
      profitMargin,
      monthsWithTransactions,
      totalMonths: 12,
      averageMonthlyRevenue,
      averageMonthlyExpenses,
      monthlyBreakdown,
    };
  } catch (error) {
    console.error('Get yearly summary error:', error);
    throw APIError.internal("Failed to get yearly summary");
  }
});

// Get quarterly summary report
export const getQuarterlySummary = api<{
  year: string;
  quarter: number; // 1, 2, 3, or 4
  propertyId?: number;
}, {
  year: string;
  quarter: number;
  quarterName: string;
  propertyId?: number;
  propertyName?: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  monthsWithTransactions: number;
  totalMonths: number;
  averageMonthlyRevenue: number;
  averageMonthlyExpenses: number;
  monthlyBreakdown: Array<{
    month: string;
    monthNumber: number;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>;
}>({
  auth: true, expose: true, method: "GET", path: "/reports/quarterly-summary"
}, async (req) => {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  const { year, quarter, propertyId } = req;

  // Validate quarter
  if (quarter < 1 || quarter > 4) {
    throw APIError.invalidArgument("Quarter must be 1, 2, 3, or 4");
  }

  try {
    // Calculate start and end months for the quarter
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    
    const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(year), endMonth, 0).toISOString().split('T')[0];

    // Build property filter
    let propertyFilter = "";
    const params: any[] = [authData.orgId, startDate, endDate];
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

    // Get monthly revenue breakdown for the quarter
    const revenueQuery = `
      SELECT 
        CAST(EXTRACT(MONTH FROM r.occurred_at AT TIME ZONE 'Asia/Kolkata') AS INTEGER) as month,
        COALESCE(SUM(CAST(r.amount_cents AS INTEGER)), 0) as total_revenue_cents
      FROM revenues r
      JOIN properties p ON r.property_id = p.id
      WHERE r.org_id = $1 
        AND p.org_id = $1
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $2::date 
        AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $3::date
        ${propertyFilter}
      GROUP BY EXTRACT(MONTH FROM r.occurred_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY month
    `;

    const revenueResults = await reportsDB.rawQueryAll(revenueQuery, ...params);

    // Get monthly expenses breakdown for the quarter
    const expensesQuery = `
      SELECT 
        CAST(EXTRACT(MONTH FROM e.expense_date) AS INTEGER) as month,
        COALESCE(SUM(CAST(e.amount_cents AS INTEGER)), 0) as total_expenses_cents
      FROM expenses e
      JOIN properties p ON e.property_id = p.id
      WHERE e.org_id = $1 
        AND p.org_id = $1
        AND e.expense_date >= $2::date AND e.expense_date <= $3::date
        ${propertyFilter}
      GROUP BY EXTRACT(MONTH FROM e.expense_date)
      ORDER BY month
    `;

    const expensesResults = await reportsDB.rawQueryAll(expensesQuery, ...params);

    // Create monthly breakdown for the quarter
    const monthlyBreakdown = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let totalRevenue = 0;
    let totalExpenses = 0;
    let monthsWithTransactions = 0;

    for (let month = startMonth; month <= endMonth; month++) {
      const monthRevenue = revenueResults.find((r: any) => parseInt(r.month) === month);
      const monthExpenses = expensesResults.find((e: any) => parseInt(e.month) === month);
      
      const revenue = monthRevenue ? parseInt(monthRevenue.total_revenue_cents) / 100 : 0;
      const expenses = monthExpenses ? parseInt(monthExpenses.total_expenses_cents) / 100 : 0;
      const netIncome = revenue - expenses;

      if (revenue > 0 || expenses > 0) {
        monthsWithTransactions++;
      }

      totalRevenue += revenue;
      totalExpenses += expenses;

      monthlyBreakdown.push({
        month: monthNames[month - 1],
        monthNumber: month,
        revenue,
        expenses,
        netIncome,
      });
    }

    const netIncome = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const averageMonthlyRevenue = monthsWithTransactions > 0 ? totalRevenue / monthsWithTransactions : 0;
    const averageMonthlyExpenses = monthsWithTransactions > 0 ? totalExpenses / monthsWithTransactions : 0;

    // Get property name if propertyId is specified
    let propertyName: string | undefined;
    if (propertyId) {
      try {
        const propertyResult = await reportsDB.queryRow`
          SELECT name FROM properties WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;
        propertyName = propertyResult?.name;
      } catch (error) {
        console.error('Property name query error:', error);
      }
    }

    const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterName = quarterNames[quarter - 1];

    return {
      year,
      quarter,
      quarterName,
      propertyId,
      propertyName,
      totalRevenue,
      totalExpenses,
      netIncome,
      profitMargin,
      monthsWithTransactions,
      totalMonths: 3,
      averageMonthlyRevenue,
      averageMonthlyExpenses,
      monthlyBreakdown,
    };
  } catch (error) {
    console.error('Get quarterly summary error:', error);
    throw APIError.internal("Failed to get quarterly summary");
  }
});
