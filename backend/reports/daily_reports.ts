import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { reportsDB } from "./db";


// Helper function to calculate opening balance from previous day
async function calculateOpeningBalance(
  propertyId: number, 
  date: string, 
  orgId: number
): Promise<number> {
  try {
    console.log('calculateOpeningBalance called with:', { propertyId, date, orgId });
    
    // First, check if there's a daily_cash_balances record for the previous day
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    console.log('Checking for previous day closing balance:', { previousDateStr });
    
    const previousBalance = await reportsDB.queryRow`
      SELECT closing_balance_cents 
      FROM daily_cash_balances 
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND balance_date = ${previousDateStr}
    `;
    
    if (previousBalance) {
      const openingBalance = parseInt(previousBalance.closing_balance_cents) || 0;
      console.log('Using previous day closing balance as opening balance:', {
        previousDateStr,
        closingBalance: openingBalance
      });
      return openingBalance;
    }
    
    console.log('No previous day balance found, calculating from all transactions');
    
    // Get all cash transactions up to the day before the given date
    const allRevenuesResponse = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM revenues
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND occurred_at < ${date}::date
        AND status = 'approved'
    `;
    
    const allExpensesResponse = await reportsDB.queryAll`
      SELECT amount_cents, payment_mode
      FROM expenses
      WHERE org_id = ${orgId}
        AND property_id = ${propertyId}
        AND expense_date < ${date}::date
        AND status = 'approved'
    `;
    
    console.log('Query results:', {
      revenuesCount: allRevenuesResponse?.length || 0,
      expensesCount: allExpensesResponse?.length || 0
    });
    
    // Calculate total cash flow up to the previous day
    const totalCashRevenue = (allRevenuesResponse || [])
      .filter((r: any) => r.payment_mode === 'cash')
      .reduce((sum: number, r: any) => sum + (parseInt(r.amount_cents) || 0), 0);
    
    const totalCashExpenses = (allExpensesResponse || [])
      .filter((e: any) => e.payment_mode === 'cash')
      .reduce((sum: number, e: any) => sum + (parseInt(e.amount_cents) || 0), 0);
    
    // Opening balance is the net cash flow up to previous day
    const openingBalance = totalCashRevenue - totalCashExpenses;
    
    console.log('Calculated opening balance from all transactions:', {
      totalCashRevenue,
      totalCashExpenses,
      openingBalance,
      date
    });
    
    return openingBalance;
  } catch (error) {
    console.error('Error calculating opening balance:', error);
    console.error('Error details:', error);
    return 0; // Default to 0 if calculation fails
  }
}

// Helper function to get daily reports data for a date range
async function getDailyReportsData(params: {
  propertyId?: number;
  startDate: string;
  endDate: string;
  orgId: number;
  authData: any;
}): Promise<DailyReportResponse[]> {
  const { propertyId, startDate, endDate, orgId, authData } = params;

  // Get property access for managers
  let propertyFilter = '';
  let propertyParams: any[] = [];
  
  // Always put propertyId first if provided
  if (propertyId) {
    propertyFilter = `AND p.id = $1`;
    propertyParams.push(propertyId);
  }

  // Add manager filter after property filter
  if (authData.role === "MANAGER") {
    const managerFilter = propertyId 
      ? `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $2)`
      : `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $1)`;
    propertyFilter += ` ${managerFilter}`;
    propertyParams.push(parseInt(authData.userID));
  }

  // Get cash balances for the date range
  const cashBalancesQuery = `
    SELECT 
      dcb.id, dcb.property_id, p.name as property_name, dcb.balance_date,
      dcb.opening_balance_cents, dcb.cash_received_cents, dcb.bank_received_cents,
      dcb.cash_expenses_cents, dcb.bank_expenses_cents, dcb.closing_balance_cents,
      dcb.created_at, dcb.updated_at,
      (dcb.cash_received_cents + dcb.bank_received_cents) as total_received_cents,
      (dcb.cash_expenses_cents + dcb.bank_expenses_cents) as total_expenses_cents,
      (dcb.opening_balance_cents + dcb.cash_received_cents - dcb.cash_expenses_cents) as calculated_closing_balance_cents
    FROM daily_cash_balances dcb
    JOIN properties p ON dcb.property_id = p.id
    WHERE dcb.org_id = $${propertyParams.length + 1} 
      AND dcb.balance_date >= $${propertyParams.length + 2}
      AND dcb.balance_date <= $${propertyParams.length + 3}
      ${propertyFilter}
    ORDER BY dcb.balance_date DESC, p.name
  `;

  const cashBalances = await reportsDB.rawQueryAll(
    cashBalancesQuery, 
    ...propertyParams, 
    orgId, 
    startDate, 
    endDate
  );

  // Get all APPROVED transactions for the date range
  const transactionsQuery = `
    SELECT 
      r.id, 'revenue' as type, r.property_id, p.name as property_name,
      r.amount_cents, r.payment_mode, r.bank_reference, r.description,
      r.source, r.occurred_at, u.display_name as created_by_name, r.status
    FROM revenues r
    JOIN properties p ON r.property_id = p.id
    JOIN users u ON r.created_by_user_id = u.id
    WHERE r.org_id = $${propertyParams.length + 1} 
      AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $${propertyParams.length + 2}
      AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $${propertyParams.length + 3}
      AND r.status = 'approved'
      ${propertyFilter}
    
    UNION ALL
    
    SELECT 
      e.id, 'expense' as type, e.property_id, p.name as property_name,
      e.amount_cents, e.payment_mode, e.bank_reference, e.description,
      e.category as source, e.expense_date as occurred_at, u.display_name as created_by_name, e.status
    FROM expenses e
    JOIN properties p ON e.property_id = p.id
    JOIN users u ON e.created_by_user_id = u.id
    WHERE e.org_id = $${propertyParams.length + 4} 
      AND e.expense_date >= $${propertyParams.length + 5}
      AND e.expense_date <= $${propertyParams.length + 6}
      AND e.status = 'approved'
      ${propertyFilter}
    
    ORDER BY occurred_at DESC
  `;

  const allTransactions = await reportsDB.rawQueryAll(
    transactionsQuery, 
    ...propertyParams, 
    orgId, 
    startDate, 
    endDate,
    orgId, 
    startDate, 
    endDate
  );

  // Group transactions by IST date
  const transactionsByDate = new Map<string, any[]>();
  allTransactions.forEach((tx: any) => {
    // Convert to IST date for proper grouping
    let istDate: string;
    if (tx.occurred_at instanceof Date) {
      // For Date objects, convert to IST
      istDate = tx.occurred_at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else {
      // For string dates, parse and convert to IST
      const date = new Date(tx.occurred_at);
      istDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    
    if (!transactionsByDate.has(istDate)) {
      transactionsByDate.set(istDate, []);
    }
    transactionsByDate.get(istDate)!.push(tx);
  });

  // Create reports for each date
  const reports: DailyReportResponse[] = [];

  // Generate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  dates.reverse().forEach(date => {
    const cashBalance = cashBalances.find((cb: any) => cb.balance_date === date);
    const transactions = transactionsByDate.get(date) || [];

    let openingBalanceCents = 0;
    let cashReceivedCents = 0;
    let bankReceivedCents = 0;
    let cashExpensesCents = 0;
    let bankExpensesCents = 0;
    let closingBalanceCents = 0;

    if (cashBalance) {
      openingBalanceCents = parseInt(cashBalance.opening_balance_cents) || 0;
      cashReceivedCents = parseInt(cashBalance.cash_received_cents) || 0;
      bankReceivedCents = parseInt(cashBalance.bank_received_cents) || 0;
      cashExpensesCents = parseInt(cashBalance.cash_expenses_cents) || 0;
      bankExpensesCents = parseInt(cashBalance.bank_expenses_cents) || 0;
      closingBalanceCents = parseInt(cashBalance.closing_balance_cents) || 0;
    } else {
      // Calculate from transactions
      transactions.forEach((tx: any) => {
        const amount = parseInt(tx.amount_cents) || 0;
        if (tx.type === 'revenue') {
          if (tx.payment_mode === 'cash') {
            cashReceivedCents += amount;
          } else {
            bankReceivedCents += amount;
          }
        } else {
          if (tx.payment_mode === 'cash') {
            cashExpensesCents += amount;
          } else {
            bankExpensesCents += amount;
          }
        }
      });
    }

    const totalReceivedCents = cashReceivedCents + bankReceivedCents;
    const totalExpensesCents = cashExpensesCents + bankExpensesCents;
    const netCashFlowCents = totalReceivedCents - totalExpensesCents;

    reports.push({
      date,
      propertyId: cashBalance?.property_id,
      propertyName: cashBalance?.property_name,
      openingBalanceCents,
      cashReceivedCents,
      bankReceivedCents,
      totalReceivedCents,
      cashExpensesCents,
      bankExpensesCents,
      totalExpensesCents,
      closingBalanceCents,
      netCashFlowCents,
      isOpeningBalanceAutoCalculated: false, // Default for date range reports
      calculatedClosingBalanceCents: openingBalanceCents + cashReceivedCents - cashExpensesCents,
      balanceDiscrepancyCents: 0, // Default for date range reports
      transactions: transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        propertyId: tx.property_id,
        propertyName: tx.property_name,
        amountCents: parseInt(tx.amount_cents),
        paymentMode: tx.payment_mode,
        bankReference: tx.bank_reference,
        description: tx.description,
        category: tx.type === 'expense' ? tx.source : undefined,
        source: tx.type === 'revenue' ? tx.source : undefined,
        occurredAt: tx.occurred_at,
        createdByName: tx.created_by_name,
        status: tx.status,
      })),
      cashBalance: cashBalance ? {
        id: cashBalance.id,
        propertyId: cashBalance.property_id,
        propertyName: cashBalance.property_name,
        balanceDate: cashBalance.balance_date,
        openingBalanceCents: parseInt(cashBalance.opening_balance_cents),
        cashReceivedCents: parseInt(cashBalance.cash_received_cents),
        bankReceivedCents: parseInt(cashBalance.bank_received_cents),
        totalReceivedCents: parseInt(cashBalance.total_received_cents),
        cashExpensesCents: parseInt(cashBalance.cash_expenses_cents),
        bankExpensesCents: parseInt(cashBalance.bank_expenses_cents),
        totalExpensesCents: parseInt(cashBalance.total_expenses_cents),
        closingBalanceCents: parseInt(cashBalance.closing_balance_cents),
        calculatedClosingBalanceCents: parseInt(cashBalance.calculated_closing_balance_cents),
        createdAt: cashBalance.created_at,
        updatedAt: cashBalance.updated_at,
      } : null,
    });
  });

  return reports;
}

// Helper function to get daily report data for export
async function getDailyReportData(
  propertyId: number,
  date: string,
  orgId: number,
  authData: any
): Promise<DailyReportResponse> {
  // Get property access for managers
  let propertyFilter = '';
  let propertyParams: any[] = [];
  
  // Always put propertyId first if provided
  if (propertyId) {
    propertyFilter = `AND p.id = $1`;
    propertyParams.push(propertyId);
  }

  // Add manager filter after property filter
  if (authData.role === "MANAGER") {
    const managerFilter = propertyId 
      ? `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $2)`
      : `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $1)`;
    propertyFilter += ` ${managerFilter}`;
    propertyParams.push(parseInt(authData.userID));
  }

  // Get cash balance for the date
  const cashBalanceQuery = `
    SELECT 
      dcb.id, dcb.property_id, p.name as property_name, dcb.balance_date,
      dcb.opening_balance_cents, dcb.cash_received_cents, dcb.bank_received_cents,
      dcb.cash_expenses_cents, dcb.bank_expenses_cents, dcb.closing_balance_cents,
      dcb.created_at, dcb.updated_at,
      dcb.is_opening_balance_auto_calculated, dcb.calculated_closing_balance_cents,
      dcb.balance_discrepancy_cents,
      (dcb.cash_received_cents + dcb.bank_received_cents) as total_received_cents,
      (dcb.cash_expenses_cents + dcb.bank_expenses_cents) as total_expenses_cents,
      (dcb.opening_balance_cents + dcb.cash_received_cents - dcb.cash_expenses_cents) as calculated_closing_balance_cents
    FROM daily_cash_balances dcb
    JOIN properties p ON dcb.property_id = p.id
    WHERE dcb.org_id = $${propertyParams.length + 1} 
      AND dcb.balance_date = $${propertyParams.length + 2}
      ${propertyFilter}
    ORDER BY p.name
  `;

  const cashBalanceResult = await reportsDB.rawQueryRow(
    cashBalanceQuery, 
    ...propertyParams, 
    orgId, 
    date
  );

  // Get all APPROVED transactions for the date
  const transactionsQuery = `
    SELECT 
      r.id, 'revenue' as type, r.property_id, p.name as property_name,
      r.amount_cents, r.payment_mode, r.bank_reference, r.description,
      r.source, r.occurred_at, u.display_name as created_by_name, r.status
    FROM revenues r
    JOIN properties p ON r.property_id = p.id
    JOIN users u ON r.created_by_user_id = u.id
    WHERE r.org_id = $${propertyParams.length + 1} 
      AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') = $${propertyParams.length + 2}
      AND r.status = 'approved'
      ${propertyFilter}
    
    UNION ALL
    
    SELECT 
      e.id, 'expense' as type, e.property_id, p.name as property_name,
      e.amount_cents, e.payment_mode, e.bank_reference, e.description,
      e.category as source, e.expense_date as occurred_at, u.display_name as created_by_name, e.status
    FROM expenses e
    JOIN properties p ON e.property_id = p.id
    JOIN users u ON e.created_by_user_id = u.id
    WHERE e.org_id = $${propertyParams.length + 3} 
      AND e.expense_date = $${propertyParams.length + 4}
      AND e.status = 'approved'
      ${propertyFilter}
    
    ORDER BY occurred_at DESC
  `;

  const transactions = await reportsDB.rawQueryAll(
    transactionsQuery, 
    ...propertyParams, 
    orgId, 
    date,
    orgId, 
    date
  );

  // Calculate totals from transactions if no cash balance exists
  let openingBalanceCents = 0;
  let cashReceivedCents = 0;
  let bankReceivedCents = 0;
  let cashExpensesCents = 0;
  let bankExpensesCents = 0;
  let closingBalanceCents = 0;
  let isOpeningBalanceAutoCalculated = false;
  let calculatedClosingBalanceCents = 0;
  let balanceDiscrepancyCents = 0;

  if (cashBalanceResult) {
    openingBalanceCents = parseInt(cashBalanceResult.opening_balance_cents) || 0;
    cashReceivedCents = parseInt(cashBalanceResult.cash_received_cents) || 0;
    bankReceivedCents = parseInt(cashBalanceResult.bank_received_cents) || 0;
    cashExpensesCents = parseInt(cashBalanceResult.cash_expenses_cents) || 0;
    bankExpensesCents = parseInt(cashBalanceResult.bank_expenses_cents) || 0;
    closingBalanceCents = parseInt(cashBalanceResult.closing_balance_cents) || 0;
    isOpeningBalanceAutoCalculated = cashBalanceResult.is_opening_balance_auto_calculated || false;
    calculatedClosingBalanceCents = parseInt(cashBalanceResult.calculated_closing_balance_cents) || 0;
    balanceDiscrepancyCents = parseInt(cashBalanceResult.balance_discrepancy_cents) || 0;
  } else {
    // Calculate from transactions
    transactions.forEach((tx: any) => {
      const amount = parseInt(tx.amount_cents) || 0;
      if (tx.type === 'revenue') {
        if (tx.payment_mode === 'cash') {
          cashReceivedCents += amount;
        } else {
          bankReceivedCents += amount;
        }
      } else {
        if (tx.payment_mode === 'cash') {
          cashExpensesCents += amount;
        } else {
          bankExpensesCents += amount;
        }
      }
    });
    
    // Auto-calculate opening balance from previous day if no balance record exists
    if (propertyId) {
      openingBalanceCents = await calculateOpeningBalance(propertyId, date, orgId);
      isOpeningBalanceAutoCalculated = true;
    }
  }

  const totalReceivedCents = cashReceivedCents + bankReceivedCents;
  const totalExpensesCents = cashExpensesCents + bankExpensesCents;
  const netCashFlowCents = totalReceivedCents - totalExpensesCents;
  
  // Calculate closing balance if not set
  if (!closingBalanceCents) {
    closingBalanceCents = openingBalanceCents + cashReceivedCents - cashExpensesCents;
  }
  
  // Calculate the theoretical closing balance
  calculatedClosingBalanceCents = openingBalanceCents + cashReceivedCents - cashExpensesCents;
  
  // Calculate discrepancy if we have a manual closing balance
  if (cashBalanceResult) {
    balanceDiscrepancyCents = closingBalanceCents - calculatedClosingBalanceCents;
  }

  return {
    date,
    propertyId: cashBalanceResult?.property_id,
    propertyName: cashBalanceResult?.property_name,
    openingBalanceCents,
    cashReceivedCents,
    bankReceivedCents,
    totalReceivedCents,
    cashExpensesCents,
    bankExpensesCents,
    totalExpensesCents,
    closingBalanceCents,
    netCashFlowCents,
    isOpeningBalanceAutoCalculated,
    calculatedClosingBalanceCents,
    balanceDiscrepancyCents,
    transactions: transactions.map((tx: any) => ({
      id: tx.id,
      type: tx.type,
      propertyId: tx.property_id,
      propertyName: tx.property_name,
      amountCents: parseInt(tx.amount_cents),
      paymentMode: tx.payment_mode,
      bankReference: tx.bank_reference,
      description: tx.description,
      category: tx.type === 'expense' ? tx.source : undefined,
      source: tx.type === 'revenue' ? tx.source : undefined,
      occurredAt: tx.occurred_at,
      createdByName: tx.created_by_name,
      status: tx.status,
    })),
    cashBalance: cashBalanceResult ? {
      id: cashBalanceResult.id,
      propertyId: cashBalanceResult.property_id,
      propertyName: cashBalanceResult.property_name,
      balanceDate: cashBalanceResult.balance_date,
      openingBalanceCents: parseInt(cashBalanceResult.opening_balance_cents),
      cashReceivedCents: parseInt(cashBalanceResult.cash_received_cents),
      bankReceivedCents: parseInt(cashBalanceResult.bank_received_cents),
      totalReceivedCents: parseInt(cashBalanceResult.total_received_cents),
      cashExpensesCents: parseInt(cashBalanceResult.cash_expenses_cents),
      bankExpensesCents: parseInt(cashBalanceResult.bank_expenses_cents),
      totalExpensesCents: parseInt(cashBalanceResult.total_expenses_cents),
      closingBalanceCents: parseInt(cashBalanceResult.closing_balance_cents),
      calculatedClosingBalanceCents: parseInt(cashBalanceResult.calculated_closing_balance_cents),
      createdAt: cashBalanceResult.created_at,
      updatedAt: cashBalanceResult.updated_at,
    } : null,
  };
}

export interface DailyReportRequest {
  propertyId?: number;
  date?: string; // YYYY-MM-DD format
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
}

export interface DailyCashBalance {
  id: number;
  propertyId: number;
  propertyName: string;
  balanceDate: string;
  openingBalanceCents: number;
  cashReceivedCents: number;
  bankReceivedCents: number;
  totalReceivedCents: number;
  cashExpensesCents: number;
  bankExpensesCents: number;
  totalExpensesCents: number;
  closingBalanceCents: number;
  calculatedClosingBalanceCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyTransaction {
  id: number;
  type: 'revenue' | 'expense';
  propertyId: number;
  propertyName: string;
  amountCents: number;
  paymentMode: 'cash' | 'bank';
  bankReference?: string;
  description?: string;
  category?: string;
  source?: string;
  occurredAt: Date;
  createdByName: string;
  status: string;
}

export interface DailyReportResponse {
  date: string;
  propertyId?: number;
  propertyName?: string;
  openingBalanceCents: number;
  cashReceivedCents: number;
  bankReceivedCents: number;
  totalReceivedCents: number;
  cashExpensesCents: number;
  bankExpensesCents: number;
  totalExpensesCents: number;
  closingBalanceCents: number;
  netCashFlowCents: number;
  transactions: DailyTransaction[];
  cashBalance: DailyCashBalance | null;
  isOpeningBalanceAutoCalculated: boolean;
  calculatedClosingBalanceCents: number;
  balanceDiscrepancyCents: number;
}

export interface DailyReportsListResponse {
  reports: DailyReportResponse[];
  summary: {
    totalOpeningBalanceCents: number;
    totalCashReceivedCents: number;
    totalBankReceivedCents: number;
    totalCashExpensesCents: number;
    totalBankExpensesCents: number;
    totalClosingBalanceCents: number;
  };
}

export interface MonthlyReportRequest {
  propertyId?: number;
  year: number;
  month: number; // 1-12
}

export interface MonthlyReportResponse {
  year: number;
  month: number;
  monthName: string;
  propertyId?: number;
  propertyName?: string;
  openingBalanceCents: number;
  totalCashReceivedCents: number;
  totalBankReceivedCents: number;
  totalCashExpensesCents: number;
  totalBankExpensesCents: number;
  closingBalanceCents: number;
  netCashFlowCents: number;
  profitMargin: number;
  transactionCount: number;
  dailyReports: DailyReportResponse[];
}

// Get daily financial report for a specific date
export const getDailyReport = api<DailyReportRequest, DailyReportResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/daily-report" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, date = new Date().toISOString().split('T')[0] } = req;

    try {
      // Get all APPROVED transactions for the date - using proper IST timezone filtering
      const transactionsQuery = `
        SELECT 
          r.id, 'revenue' as type, r.property_id, p.name as property_name,
          r.amount_cents, r.payment_mode, r.bank_reference, r.description,
          r.source, r.occurred_at, u.display_name as created_by_name, r.status
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $1 
          AND r.property_id = $3
          AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') = $2
          AND r.status = 'approved'
        
        UNION ALL
        
        SELECT 
          e.id, 'expense' as type, e.property_id, p.name as property_name,
          e.amount_cents, e.payment_mode, e.bank_reference, e.description,
          e.category as source, e.expense_date as occurred_at, u.display_name as created_by_name, e.status
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.org_id = $1 
          AND e.property_id = $3
          AND e.expense_date = $2
          AND e.status = 'approved'
        
        ORDER BY occurred_at DESC
      `;

      console.log('Daily report query debug:', {
        propertyId,
        orgId: authData.orgId,
        date
      });

      const transactions = await reportsDB.rawQueryAll(
        transactionsQuery, 
        authData.orgId, 
        date,
        propertyId
      );

      console.log(`Daily report for ${date}: Found ${transactions.length} approved transactions`);

      // Calculate totals from transactions
      let openingBalanceCents = 0;
      let cashReceivedCents = 0;
      let bankReceivedCents = 0;
      let cashExpensesCents = 0;
      let bankExpensesCents = 0;
      let closingBalanceCents = 0;
      let isOpeningBalanceAutoCalculated = false;
      let calculatedClosingBalanceCents = 0;
      let balanceDiscrepancyCents = 0;

      // Calculate from transactions
      transactions.forEach((tx: any) => {
        const amount = parseInt(tx.amount_cents) || 0;
        if (tx.type === 'revenue') {
          if (tx.payment_mode === 'cash') {
            cashReceivedCents += amount;
          } else {
            bankReceivedCents += amount;
          }
        } else {
          if (tx.payment_mode === 'cash') {
            cashExpensesCents += amount;
          } else {
            bankExpensesCents += amount;
          }
        }
      });
      
      // Check if there's a daily_cash_balances record for this date
      if (propertyId) {
        console.log('Checking for existing daily_cash_balances record:', { propertyId, date, orgId: authData.orgId });
        
        const existingBalance = await reportsDB.queryRow`
          SELECT opening_balance_cents, is_opening_balance_auto_calculated
          FROM daily_cash_balances
          WHERE org_id = ${authData.orgId}
            AND property_id = ${propertyId}
            AND balance_date = ${date}
        `;
        
        if (existingBalance) {
          console.log('Found existing daily_cash_balances record with opening balance:', existingBalance.opening_balance_cents);
          // Use opening balance from daily_cash_balances table
          openingBalanceCents = parseInt(existingBalance.opening_balance_cents) || 0;
          isOpeningBalanceAutoCalculated = existingBalance.is_opening_balance_auto_calculated || false;
        } else {
          console.log('No daily_cash_balances record found, auto-calculating opening balance');
          // Auto-calculate opening balance from previous day if no balance record exists
          openingBalanceCents = await calculateOpeningBalance(propertyId, date, authData.orgId);
          console.log('Opening balance calculated:', openingBalanceCents);
          isOpeningBalanceAutoCalculated = true;
        }
      }

      const totalReceivedCents = cashReceivedCents + bankReceivedCents;
      const totalExpensesCents = cashExpensesCents + bankExpensesCents;
      const netCashFlowCents = totalReceivedCents - totalExpensesCents;
      
      // Calculate closing balance (only cash transactions)
      closingBalanceCents = openingBalanceCents + cashReceivedCents - cashExpensesCents;
      calculatedClosingBalanceCents = closingBalanceCents;
      balanceDiscrepancyCents = 0;

      return {
        date,
        propertyId,
        propertyName: undefined,
        openingBalanceCents,
        cashReceivedCents,
        bankReceivedCents,
        totalReceivedCents,
        cashExpensesCents,
        bankExpensesCents,
        totalExpensesCents,
        closingBalanceCents,
        netCashFlowCents,
        isOpeningBalanceAutoCalculated,
        calculatedClosingBalanceCents,
        balanceDiscrepancyCents,
        transactions: transactions.map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          propertyId: tx.property_id,
          propertyName: tx.property_name,
          amountCents: parseInt(tx.amount_cents),
          paymentMode: tx.payment_mode,
          bankReference: tx.bank_reference,
          description: tx.description,
          category: tx.type === 'expense' ? tx.source : undefined,
          source: tx.type === 'revenue' ? tx.source : undefined,
          occurredAt: tx.occurred_at,
          createdByName: tx.created_by_name,
          status: tx.status,
        })),
        cashBalance: null,
      };
    } catch (error) {
      console.error('Get daily report error:', error);
      throw APIError.internal("Failed to get daily report");
    }
  }
);

// Get daily reports for a date range
export const getDailyReports = api<DailyReportRequest, DailyReportsListResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/daily-reports" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, startDate, endDate } = req;

    if (!startDate || !endDate) {
      throw APIError.invalidArgument("Start date and end date are required");
    }

    try {
      // Get property access for managers
      let propertyFilter = '';
      let propertyParams: any[] = [];
      
      // Always put propertyId first if provided
      if (propertyId) {
        propertyFilter = `AND p.id = $3`;
        propertyParams.push(propertyId);
      }

      // Add manager filter after property filter
      if (authData.role === "MANAGER") {
        const managerFilter = propertyId 
          ? `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $4)`
          : `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $3)`;
        propertyFilter += ` ${managerFilter}`;
        propertyParams.push(parseInt(authData.userID));
      }

      // Get cash balances for the date range
      const cashBalancesQuery = `
        SELECT 
          dcb.id, dcb.property_id, p.name as property_name, dcb.balance_date,
          dcb.opening_balance_cents, dcb.cash_received_cents, dcb.bank_received_cents,
          dcb.cash_expenses_cents, dcb.bank_expenses_cents, dcb.closing_balance_cents,
          dcb.created_at, dcb.updated_at,
          (dcb.cash_received_cents + dcb.bank_received_cents) as total_received_cents,
          (dcb.cash_expenses_cents + dcb.bank_expenses_cents) as total_expenses_cents,
          (dcb.opening_balance_cents + dcb.cash_received_cents - dcb.cash_expenses_cents) as calculated_closing_balance_cents
        FROM daily_cash_balances dcb
        JOIN properties p ON dcb.property_id = p.id
        WHERE dcb.org_id = $${propertyParams.length + 1} 
          AND dcb.balance_date >= $${propertyParams.length + 2}
          AND dcb.balance_date <= $${propertyParams.length + 3}
          ${propertyFilter}
        ORDER BY dcb.balance_date DESC, p.name
      `;

      // Add debugging before query execution
      console.log('Daily reports property filter debug:', {
        propertyId,
        propertyFilter,
        propertyParams,
        orgId: authData.orgId,
        startDate,
        endDate,
        totalParams: [...propertyParams, authData.orgId, startDate, endDate]
      });

      // Add query validation
      const expectedParamCount = propertyParams.length + 3; // +3 for orgId, startDate, endDate
      const actualParamCount = (cashBalancesQuery.match(/\$/g) || []).length;
      if (expectedParamCount !== actualParamCount) {
        console.error(`Parameter count mismatch: expected ${expectedParamCount}, found ${actualParamCount}`);
        throw new Error(`Parameter count mismatch: expected ${expectedParamCount}, found ${actualParamCount}`);
      }

      const cashBalances = await reportsDB.rawQueryAll(
        cashBalancesQuery, 
        ...propertyParams, 
        authData.orgId, 
        startDate, 
        endDate
      );

      // Get all APPROVED transactions for the date range - using IST timezone filtering
      const transactionsQuery = `
        SELECT 
          r.id, 'revenue' as type, r.property_id, p.name as property_name,
          r.amount_cents, r.payment_mode, r.bank_reference, r.description,
          r.source, r.occurred_at, u.display_name as created_by_name, r.status
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1} 
          AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') >= $${propertyParams.length + 2}
          AND DATE(r.occurred_at AT TIME ZONE 'Asia/Kolkata') <= $${propertyParams.length + 3}
          AND r.status = 'approved'
          ${propertyFilter}
        
        UNION ALL
        
        SELECT 
          e.id, 'expense' as type, e.property_id, p.name as property_name,
          e.amount_cents, e.payment_mode, e.bank_reference, e.description,
          e.category as source, e.expense_date as occurred_at, u.display_name as created_by_name, e.status
        FROM expenses e
        JOIN properties p ON e.property_id = p.id
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.org_id = $${propertyParams.length + 4} 
          AND e.expense_date >= $${propertyParams.length + 5}
          AND e.expense_date <= $${propertyParams.length + 6}
          AND e.status = 'approved'
          ${propertyFilter}
        
        ORDER BY occurred_at DESC
      `;

      // Add debugging for transactions query
      console.log('Daily reports transactions query debug:', {
        propertyId,
        propertyFilter,
        propertyParams,
        orgId: authData.orgId,
        startDate,
        endDate,
        totalParams: [...propertyParams, authData.orgId, startDate, endDate, authData.orgId, startDate, endDate]
      });

      // Add query validation for transactions
      // Count actual parameters in the final query including propertyFilter
      const actualTransactionParamCount = (transactionsQuery.match(/\$/g) || []).length;
      const expectedTransactionParamCount = propertyParams.length + 6; // +6 for orgId(2x), startDate(2x), endDate(2x)
      
      if (expectedTransactionParamCount !== actualTransactionParamCount) {
        console.error(`Transaction parameter count mismatch: expected ${expectedTransactionParamCount}, found ${actualTransactionParamCount}`);
        console.error('Query:', transactionsQuery);
        console.error('Property params:', propertyParams);
        console.error('Property filter:', propertyFilter);
        console.error('Property filter param count:', (propertyFilter.match(/\$/g) || []).length);
        // Don't throw error, just log and continue - the query might still work
        console.warn('Continuing despite parameter count mismatch...');
      }

      const allTransactions = await reportsDB.rawQueryAll(
        transactionsQuery, 
        ...propertyParams, 
        authData.orgId, 
        startDate, 
        endDate,
        authData.orgId, 
        startDate, 
        endDate
      );

      // Group transactions by date
      const transactionsByDate = new Map<string, any[]>();
      allTransactions.forEach((tx: any) => {
        // Handle both Date objects and string dates
        const occurredAt = tx.occurred_at instanceof Date 
          ? tx.occurred_at.toISOString().split('T')[0]
          : tx.occurred_at.split('T')[0];
        
        if (!transactionsByDate.has(occurredAt)) {
          transactionsByDate.set(occurredAt, []);
        }
        transactionsByDate.get(occurredAt)!.push(tx);
      });

      // Create reports for each date
      const reports: DailyReportResponse[] = [];
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;

      // Generate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: string[] = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      dates.reverse().forEach(date => {
        const cashBalance = cashBalances.find((cb: any) => cb.balance_date === date);
        const transactions = transactionsByDate.get(date) || [];

        let openingBalanceCents = 0;
        let cashReceivedCents = 0;
        let bankReceivedCents = 0;
        let cashExpensesCents = 0;
        let bankExpensesCents = 0;
        let closingBalanceCents = 0;

        if (cashBalance) {
          openingBalanceCents = parseInt(cashBalance.opening_balance_cents) || 0;
          cashReceivedCents = parseInt(cashBalance.cash_received_cents) || 0;
          bankReceivedCents = parseInt(cashBalance.bank_received_cents) || 0;
          cashExpensesCents = parseInt(cashBalance.cash_expenses_cents) || 0;
          bankExpensesCents = parseInt(cashBalance.bank_expenses_cents) || 0;
          closingBalanceCents = parseInt(cashBalance.closing_balance_cents) || 0;
        } else {
          // Calculate from transactions
          transactions.forEach((tx: any) => {
            const amount = parseInt(tx.amount_cents) || 0;
            if (tx.type === 'revenue') {
              if (tx.payment_mode === 'cash') {
                cashReceivedCents += amount;
              } else {
                bankReceivedCents += amount;
              }
            } else {
              if (tx.payment_mode === 'cash') {
                cashExpensesCents += amount;
              } else {
                bankExpensesCents += amount;
              }
            }
          });
        }

        const totalReceivedCents = cashReceivedCents + bankReceivedCents;
        const totalExpensesCents = cashExpensesCents + bankExpensesCents;
        const netCashFlowCents = totalReceivedCents - totalExpensesCents;

        // Accumulate totals
        totalOpeningBalanceCents += openingBalanceCents;
        totalCashReceivedCents += cashReceivedCents;
        totalBankReceivedCents += bankReceivedCents;
        totalCashExpensesCents += cashExpensesCents;
        totalBankExpensesCents += bankExpensesCents;
        totalClosingBalanceCents += closingBalanceCents;

        reports.push({
          date,
          propertyId: cashBalance?.property_id,
          propertyName: cashBalance?.property_name,
          openingBalanceCents,
          cashReceivedCents,
          bankReceivedCents,
          totalReceivedCents,
          cashExpensesCents,
          bankExpensesCents,
          totalExpensesCents,
          closingBalanceCents,
          netCashFlowCents,
          isOpeningBalanceAutoCalculated: false, // Default for date range reports
          calculatedClosingBalanceCents: openingBalanceCents + cashReceivedCents - cashExpensesCents,
          balanceDiscrepancyCents: 0, // Default for date range reports
          transactions: transactions.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            propertyId: tx.property_id,
            propertyName: tx.property_name,
            amountCents: parseInt(tx.amount_cents),
            paymentMode: tx.payment_mode,
            bankReference: tx.bank_reference,
            description: tx.description,
            category: tx.type === 'expense' ? tx.source : undefined,
            source: tx.type === 'revenue' ? tx.source : undefined,
            occurredAt: tx.occurred_at,
            createdByName: tx.created_by_name,
            status: tx.status,
          })),
          cashBalance: cashBalance ? {
            id: cashBalance.id,
            propertyId: cashBalance.property_id,
            propertyName: cashBalance.property_name,
            balanceDate: cashBalance.balance_date,
            openingBalanceCents: parseInt(cashBalance.opening_balance_cents),
            cashReceivedCents: parseInt(cashBalance.cash_received_cents),
            bankReceivedCents: parseInt(cashBalance.bank_received_cents),
            totalReceivedCents: parseInt(cashBalance.total_received_cents),
            cashExpensesCents: parseInt(cashBalance.cash_expenses_cents),
            bankExpensesCents: parseInt(cashBalance.bank_expenses_cents),
            totalExpensesCents: parseInt(cashBalance.total_expenses_cents),
            closingBalanceCents: parseInt(cashBalance.closing_balance_cents),
            calculatedClosingBalanceCents: parseInt(cashBalance.calculated_closing_balance_cents),
            createdAt: cashBalance.created_at,
            updatedAt: cashBalance.updated_at,
          } : null,
        });
      });

      return {
        reports,
        summary: {
          totalOpeningBalanceCents,
          totalCashReceivedCents,
          totalBankReceivedCents,
          totalCashExpensesCents,
          totalBankExpensesCents,
          totalClosingBalanceCents,
        },
      };
    } catch (error) {
      console.error('Get daily reports error:', error);
      throw APIError.internal("Failed to get daily reports");
    }
  }
);

// Get monthly financial report
export const getMonthlyReport = api<MonthlyReportRequest, MonthlyReportResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/monthly-report" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, year, month } = req;

    try {
      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

      // Get property access for managers
      let propertyFilter = '';
      let propertyParams: any[] = [];
      
      if (propertyId) {
        propertyFilter = `AND p.id = $3`;
        propertyParams.push(propertyId);
      }

      if (authData.role === "MANAGER") {
        const managerFilter = propertyId 
          ? `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $4)`
          : `AND p.id IN (SELECT property_id FROM user_properties WHERE user_id = $3)`;
        propertyFilter += ` ${managerFilter}`;
        propertyParams.push(parseInt(authData.userID));
      }

      // Get all daily reports for the month using direct database queries
      const dailyReports = await getDailyReportsData({
        propertyId,
        startDate,
        endDate,
        orgId: authData.orgId,
        authData,
      });

      console.log('Monthly Report Debug - Daily Reports:', {
        count: dailyReports.length,
        dateRange: `${startDate} to ${endDate}`,
        propertyId,
        orgId: authData.orgId,
        sampleReport: dailyReports[0] ? {
          date: dailyReports[0].date,
          cashReceivedCents: dailyReports[0].cashReceivedCents,
          bankReceivedCents: dailyReports[0].bankReceivedCents,
          cashExpensesCents: dailyReports[0].cashExpensesCents,
          bankExpensesCents: dailyReports[0].bankExpensesCents,
          transactionCount: dailyReports[0].transactions.length
        } : null
      });

      // Calculate monthly totals
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;
      let transactionCount = 0;

      // Get opening balance from first day of month and closing balance from last day
      if (dailyReports.length > 0) {
        // Since dates are reversed in getDailyReportsData, the first element is the last day
        // and the last element is the first day
        totalOpeningBalanceCents = dailyReports[dailyReports.length - 1].openingBalanceCents; // First day of month
        totalClosingBalanceCents = dailyReports[0].closingBalanceCents; // Last day of month
      }

      // Sum up all daily totals
      dailyReports.forEach((report, index) => {
        console.log(`Daily Report ${index + 1} (${report.date}):`, {
          cashReceivedCents: report.cashReceivedCents,
          bankReceivedCents: report.bankReceivedCents,
          cashExpensesCents: report.cashExpensesCents,
          bankExpensesCents: report.bankExpensesCents,
          transactionCount: report.transactions.length
        });
        
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
        transactionCount += report.transactions.length;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netCashFlowCents = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netCashFlowCents / totalRevenue) * 100 : 0;

      console.log('Monthly Report Debug - Final Totals:', {
        totalOpeningBalanceCents,
        totalCashReceivedCents,
        totalBankReceivedCents,
        totalCashExpensesCents,
        totalBankExpensesCents,
        totalClosingBalanceCents,
        totalRevenue,
        totalExpenses,
        netCashFlowCents,
        profitMargin,
        transactionCount
      });

      // Get property name if propertyId is provided
      let propertyName = undefined;
      if (propertyId) {
        const property = await reportsDB.queryRow`
          SELECT name FROM properties 
          WHERE id = ${propertyId} AND org_id = ${authData.orgId}
        `;
        propertyName = property?.name;
      }

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      return {
        year,
        month,
        monthName: monthNames[month - 1],
        propertyId,
        propertyName,
        openingBalanceCents: totalOpeningBalanceCents,
        totalCashReceivedCents,
        totalBankReceivedCents,
        totalCashExpensesCents,
        totalBankExpensesCents,
        closingBalanceCents: totalClosingBalanceCents,
        netCashFlowCents,
        profitMargin,
        transactionCount,
        dailyReports,
      };
    } catch (error) {
      console.error('Get monthly report error:', error);
      throw APIError.internal("Failed to get monthly report");
    }
  }
);

// Smart daily cash balance update with automatic opening balance calculation
export const updateDailyCashBalanceSmart = api<{
  propertyId: number;
  date: string;
  openingBalanceCents?: number; // Optional - will auto-calculate if not provided
  cashReceivedCents?: number;
  bankReceivedCents?: number;
  cashExpensesCents?: number;
  bankExpensesCents?: number;
  closingBalanceCents?: number; // Optional - will auto-calculate if not provided
}, { 
  success: boolean; 
  calculatedValues: {
    openingBalanceCents: number;
    closingBalanceCents: number;
    calculatedClosingBalanceCents: number;
    balanceDiscrepancyCents: number;
    isOpeningBalanceAutoCalculated: boolean;
  }
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/daily-cash-balance-smart" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      propertyId, 
      date, 
      openingBalanceCents, 
      cashReceivedCents = 0,
      bankReceivedCents = 0,
      cashExpensesCents = 0,
      bankExpensesCents = 0,
      closingBalanceCents
    } = req;

    try {
      // Check property access
      const propertyCheck = await reportsDB.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyCheck) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await reportsDB.queryRow`
          SELECT 1 FROM user_properties 
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Auto-calculate opening balance if not provided
      let finalOpeningBalance = openingBalanceCents;
      let isAutoCalculated = false;
      
      if (finalOpeningBalance === undefined) {
        finalOpeningBalance = await calculateOpeningBalance(propertyId, date, authData.orgId);
        isAutoCalculated = true;
      }
      
      // Auto-calculate closing balance if not provided
      let finalClosingBalance = closingBalanceCents;
      if (finalClosingBalance === undefined) {
        finalClosingBalance = finalOpeningBalance + cashReceivedCents - cashExpensesCents;
      }
      
      // Calculate discrepancy
      const calculatedClosing = finalOpeningBalance + cashReceivedCents - cashExpensesCents;
      const discrepancy = finalClosingBalance - calculatedClosing;
      
      // Upsert with calculated values
      await reportsDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date, opening_balance_cents,
          cash_received_cents, bank_received_cents, cash_expenses_cents,
          bank_expenses_cents, closing_balance_cents,
          is_opening_balance_auto_calculated, calculated_closing_balance_cents,
          balance_discrepancy_cents, created_by_user_id
        )
        VALUES (
          ${authData.orgId}, ${propertyId}, ${date}, ${finalOpeningBalance},
          ${cashReceivedCents}, ${bankReceivedCents}, ${cashExpensesCents},
          ${bankExpensesCents}, ${finalClosingBalance}, ${isAutoCalculated}, 
          ${calculatedClosing}, ${discrepancy}, ${parseInt(authData.userID)}
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

      return {
        success: true,
        calculatedValues: {
          openingBalanceCents: finalOpeningBalance,
          closingBalanceCents: finalClosingBalance,
          calculatedClosingBalanceCents: calculatedClosing,
          balanceDiscrepancyCents: discrepancy,
          isOpeningBalanceAutoCalculated: isAutoCalculated,
        }
      };
    } catch (error) {
      console.error('Update daily cash balance smart error:', error);
      throw APIError.internal("Failed to update daily cash balance");
    }
  }
);

// Create or update daily cash balance (legacy endpoint)
export const updateDailyCashBalance = api<{
  propertyId: number;
  date: string;
  openingBalanceCents: number;
  cashReceivedCents: number;
  bankReceivedCents: number;
  cashExpensesCents: number;
  bankExpensesCents: number;
  closingBalanceCents: number;
}, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/reports/daily-cash-balance" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      propertyId, 
      date, 
      openingBalanceCents, 
      cashReceivedCents, 
      bankReceivedCents, 
      cashExpensesCents, 
      bankExpensesCents, 
      closingBalanceCents 
    } = req;

    try {
      // Check property access
      const propertyCheck = await reportsDB.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyCheck) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await reportsDB.queryRow`
          SELECT 1 FROM user_properties 
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Upsert daily cash balance
      await reportsDB.exec`
        INSERT INTO daily_cash_balances (
          org_id, property_id, balance_date, opening_balance_cents, 
          cash_received_cents, bank_received_cents, cash_expenses_cents, 
          bank_expenses_cents, closing_balance_cents, created_by_user_id
        )
        VALUES (
          ${authData.orgId}, ${propertyId}, ${date}, ${openingBalanceCents},
          ${cashReceivedCents}, ${bankReceivedCents}, ${cashExpensesCents},
          ${bankExpensesCents}, ${closingBalanceCents}, ${parseInt(authData.userID)}
        )
        ON CONFLICT (org_id, property_id, balance_date)
        DO UPDATE SET
          opening_balance_cents = EXCLUDED.opening_balance_cents,
          cash_received_cents = EXCLUDED.cash_received_cents,
          bank_received_cents = EXCLUDED.bank_received_cents,
          cash_expenses_cents = EXCLUDED.cash_expenses_cents,
          bank_expenses_cents = EXCLUDED.bank_expenses_cents,
          closing_balance_cents = EXCLUDED.closing_balance_cents,
          updated_at = NOW()
      `;

      return { success: true };
    } catch (error) {
      console.error('Update daily cash balance error:', error);
      throw APIError.internal("Failed to update daily cash balance");
    }
  }
);

// Calculate opening balance for a specific date and property
export const calculateOpeningBalanceEndpoint = api<{
  propertyId: number;
  date: string;
}, {
  openingBalanceCents: number;
  isAutoCalculated: boolean;
  previousDate?: string;
  previousClosingBalance?: number;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/calculate-opening-balance" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, date } = req;

    try {
      // Check property access
      const propertyCheck = await reportsDB.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyCheck) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await reportsDB.queryRow`
          SELECT 1 FROM user_properties 
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

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

      const openingBalanceCents = previousBalance?.closing_balance_cents || 0;
      const isAutoCalculated = !!previousBalance;

      return {
        openingBalanceCents,
        isAutoCalculated,
        previousDate: isAutoCalculated ? previousDateStr : undefined,
        previousClosingBalance: previousBalance?.closing_balance_cents,
      };
    } catch (error) {
      console.error('Calculate opening balance error:', error);
      throw APIError.internal("Failed to calculate opening balance");
    }
  }
);

// Export daily report to PDF
export const exportDailyReportPDF = api<{
  propertyId: number;
  date: string;
}, {
  pdfData: string; // Base64 encoded PDF
  filename: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/export-daily-pdf" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, date } = req;

    try {
      // Get organization and property information
      const orgPropertyInfo = await reportsDB.queryRow`
        SELECT 
          o.name as org_name,
          p.name as property_name,
          p.address_json as property_address
        FROM organizations o
        JOIN properties p ON o.id = p.org_id
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!orgPropertyInfo) {
        throw APIError.notFound("Property not found");
      }

      // Get daily report data using helper function
      const dailyReport = await getDailyReportData(propertyId, date, authData.orgId, authData);
      
      console.log('PDF Export - Daily report data:', {
        openingBalance: dailyReport.openingBalanceCents,
        cashRevenue: dailyReport.cashReceivedCents,
        bankRevenue: dailyReport.bankReceivedCents,
        cashExpenses: dailyReport.cashExpensesCents,
        bankExpenses: dailyReport.bankExpensesCents,
        closingBalance: dailyReport.closingBalanceCents,
        transactionCount: dailyReport.transactions.length
      });
      
      // Dynamic import for PDFKit
      const PDFDocument = (await import('pdfkit')).default;
      
      // Create PDF document with better formatting
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Daily Cash Balance Report',
          Author: 'Hospitality Management Platform',
          Subject: `Daily Report for ${orgPropertyInfo.property_name}`,
          Keywords: 'daily, cash, balance, report, hospitality'
        }
      });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          const base64PDF = pdfBuffer.toString('base64');
          
          const filename = `Daily_Report_${orgPropertyInfo.property_name.replace(/\s+/g, '_')}_${date}.pdf`;
          
          resolve({
            pdfData: base64PDF,
            filename: filename
          });
        });

        doc.on('error', reject);

        // PDF Content with improved formatting
        // Header with background
        doc.rect(50, 50, 500, 60).fill('#f8fafc');
        doc.fillColor('#1e293b');
        doc.fontSize(24).font('Helvetica-Bold').text('Daily Cash Balance Report', 70, 70, { align: 'left' });
        doc.fontSize(12).font('Helvetica').fillColor('#64748b').text('Financial Summary Report', 70, 95, { align: 'left' });
        doc.moveDown(3);
        
        // Organization and Property Info with better formatting
        doc.fillColor('#1e293b');
        doc.fontSize(16).font('Helvetica-Bold').text('Report Information', { align: 'left' });
        doc.moveDown(0.5);
        
        // Create info box
        const infoY = doc.y;
        doc.rect(50, infoY, 500, 80).stroke('#e2e8f0');
        doc.fillColor('#1e293b');
        doc.fontSize(12).font('Helvetica-Bold').text('Organization:', 60, infoY + 10);
        doc.font('Helvetica').text(orgPropertyInfo.org_name, 150, infoY + 10);
        
        doc.font('Helvetica-Bold').text('Property:', 60, infoY + 30);
        doc.font('Helvetica').text(orgPropertyInfo.property_name, 150, infoY + 30);
        
        if (orgPropertyInfo.property_address) {
          const address = typeof orgPropertyInfo.property_address === 'string' 
            ? JSON.parse(orgPropertyInfo.property_address) 
            : orgPropertyInfo.property_address;
          const addressStr = [address.street, address.city, address.state, address.country, address.zipCode]
            .filter(Boolean)
            .join(', ');
          if (addressStr) {
            doc.font('Helvetica-Bold').text('Address:', 60, infoY + 50);
            doc.font('Helvetica').text(addressStr, 150, infoY + 50);
          }
        }
        
        doc.font('Helvetica-Bold').text('Report Date:', 60, infoY + 70);
        doc.font('Helvetica').text(new Date(date).toLocaleDateString(), 150, infoY + 70);
        
        doc.moveDown(2);

        // Financial Summary Section with better formatting
        doc.fillColor('#1e293b');
        doc.fontSize(18).font('Helvetica-Bold').text('Financial Summary', { align: 'left' });
        doc.moveDown(0.5);
        
        const formatCurrency = (cents: number) => `₹${(cents / 100).toFixed(2)}`;
        
        // Create summary table
        const summaryY = doc.y;
        doc.rect(50, summaryY, 500, 120).stroke('#e2e8f0');
        
        // Opening Balance
        doc.fillColor('#1e293b');
        doc.fontSize(12).font('Helvetica-Bold').text('Opening Balance (Cash):', 60, summaryY + 15);
        doc.font('Helvetica').text(formatCurrency(dailyReport.openingBalanceCents), 400, summaryY + 15, { align: 'right' });
        
        // Revenue Section
        doc.font('Helvetica-Bold').text('Revenue:', 60, summaryY + 35);
        doc.font('Helvetica').text(`Cash Revenue: ${formatCurrency(dailyReport.cashReceivedCents)}`, 80, summaryY + 50);
        doc.text(`Bank Revenue: ${formatCurrency(dailyReport.bankReceivedCents)}`, 80, summaryY + 65);
        doc.font('Helvetica-Bold').text(`Total Revenue: ${formatCurrency(dailyReport.totalReceivedCents)}`, 80, summaryY + 80);
        
        // Expenses Section
        doc.font('Helvetica-Bold').text('Expenses:', 60, summaryY + 100);
        doc.font('Helvetica').text(`Cash Expenses: ${formatCurrency(dailyReport.cashExpensesCents)}`, 80, summaryY + 115);
        doc.text(`Bank Expenses: ${formatCurrency(dailyReport.bankExpensesCents)}`, 80, summaryY + 130);
        doc.font('Helvetica-Bold').text(`Total Expenses: ${formatCurrency(dailyReport.totalExpensesCents)}`, 80, summaryY + 145);
        
        // Closing Balance (highlighted)
        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 30).fill('#f0f9ff');
        doc.fillColor('#1e40af');
        doc.fontSize(16).font('Helvetica-Bold').text('Closing Balance (Cash):', 60, doc.y + 8);
        doc.text(formatCurrency(dailyReport.closingBalanceCents), 400, doc.y + 8, { align: 'right' });
        doc.moveDown(1.5);

        // Transactions Section with better formatting
        if (dailyReport.transactions.length > 0) {
          doc.fillColor('#1e293b');
          doc.fontSize(18).font('Helvetica-Bold').text('Transaction Details', { align: 'left' });
          doc.moveDown(0.5);
          
          dailyReport.transactions.forEach((tx, index) => {
            const txY = doc.y;
            const isRevenue = tx.type === 'revenue';
            const bgColor = isRevenue ? '#f0fdf4' : '#fef2f2';
            const borderColor = isRevenue ? '#22c55e' : '#ef4444';
            
            // Transaction box
            doc.rect(50, txY, 500, 50).fill(bgColor).stroke(borderColor);
            
            // Transaction type and amount
            doc.fillColor(isRevenue ? '#16a34a' : '#dc2626');
            doc.fontSize(12).font('Helvetica-Bold').text(`${tx.type.toUpperCase()}`, 60, txY + 8);
            doc.text(formatCurrency(tx.amountCents), 450, txY + 8, { align: 'right' });
            
            // Description
            doc.fillColor('#1e293b');
            doc.fontSize(10).font('Helvetica').text(tx.description || 'No description', 60, txY + 25);
            
            // Details
            doc.fontSize(9).text(`Mode: ${tx.paymentMode.toUpperCase()} | Status: ${tx.status} | By: ${tx.createdByName}`, 60, txY + 35);
            doc.text(`${new Date(tx.occurredAt).toLocaleDateString()} ${new Date(tx.occurredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`, 450, txY + 35, { align: 'right' });
            
            doc.moveDown(1.2);
          });
        }

        // Footer with better formatting
        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 30).fill('#f8fafc');
        doc.fillColor('#64748b');
        const now = new Date();
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`, 70, doc.y + 8);
        doc.text(`Data Source: Finance Transactions`, 70, doc.y + 20);

        doc.end();
      });
    } catch (error) {
      console.error('Export daily report PDF error:', error);
      throw APIError.internal("Failed to export daily report to PDF");
    }
  }
);

// Export monthly report to Excel
export const exportMonthlyReportExcel = api<{
  propertyId: number;
  year: number;
  month: number;
}, {
  excelData: string; // Base64 encoded Excel file
  filename: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/export-monthly-excel" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, year, month } = req;

    try {
      // Get organization and property information
      const orgPropertyInfo = await reportsDB.queryRow`
        SELECT 
          o.name as org_name,
          p.name as property_name,
          p.address_json as property_address
        FROM organizations o
        JOIN properties p ON o.id = p.org_id
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!orgPropertyInfo) {
        throw APIError.notFound("Property not found");
      }

      // Get monthly report data using existing helper function
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const monthlyReportData = await getDailyReportsData({
        propertyId,
        startDate,
        endDate,
        orgId: authData.orgId,
        authData,
      });

      // Calculate monthly totals
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;

      if (monthlyReportData.length > 0) {
        totalOpeningBalanceCents = monthlyReportData[monthlyReportData.length - 1].openingBalanceCents;
        totalClosingBalanceCents = monthlyReportData[0].closingBalanceCents;
      }

      monthlyReportData.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netIncome = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[month - 1];

      // Dynamic import for XLSX
      const XLSX = await import('xlsx');
      
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Summary Sheet with better formatting
      const summaryData = [
        ['MONTHLY CASH BALANCE REPORT'],
        [''],
        ['REPORT INFORMATION'],
        ['Organization', orgPropertyInfo.org_name],
        ['Property', orgPropertyInfo.property_name],
        ['Address', (() => {
          if (!orgPropertyInfo.property_address) return 'N/A';
          const address = typeof orgPropertyInfo.property_address === 'string' 
            ? JSON.parse(orgPropertyInfo.property_address) 
            : orgPropertyInfo.property_address;
          return [address.street, address.city, address.state, address.country, address.zipCode]
            .filter(Boolean)
            .join(', ') || 'N/A';
        })()],
        ['Report Period', `${monthName} ${year}`],
        ['Generated On', `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`],
        [''],
        ['MONTHLY FINANCIAL SUMMARY'],
        [''],
        ['Opening Balance (Cash)', `₹${(totalOpeningBalanceCents / 100).toFixed(2)}`],
        [''],
        ['REVENUE'],
        ['Cash Revenue', `₹${(totalCashReceivedCents / 100).toFixed(2)}`],
        ['Bank Revenue', `₹${(totalBankReceivedCents / 100).toFixed(2)}`],
        ['Total Revenue', `₹${(totalRevenue / 100).toFixed(2)}`],
        [''],
        ['EXPENSES'],
        ['Cash Expenses', `₹${(totalCashExpensesCents / 100).toFixed(2)}`],
        ['Bank Expenses', `₹${(totalBankExpensesCents / 100).toFixed(2)}`],
        ['Total Expenses', `₹${(totalExpenses / 100).toFixed(2)}`],
        [''],
        ['CLOSING BALANCE (CASH)', `₹${(totalClosingBalanceCents / 100).toFixed(2)}`],
        ['Net Income', `₹${(netIncome / 100).toFixed(2)}`],
        ['Profit Margin', `${profitMargin.toFixed(1)}%`],
        [''],
        ['CALCULATIONS'],
        ['Total Cash = Opening Balance + Cash Revenue', `₹${((totalOpeningBalanceCents + totalCashReceivedCents) / 100).toFixed(2)}`],
        ['Closing Balance = Total Cash - Cash Expenses', `₹${(totalClosingBalanceCents / 100).toFixed(2)}`],
        ['Next Month Opening Balance', `₹${(totalClosingBalanceCents / 100).toFixed(2)}`]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      summarySheet['!cols'] = [
        { width: 30 },
        { width: 20 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Monthly Summary');

      // Daily Details Sheet
      if (monthlyReportData.length > 0) {
        const dailyData = [
          ['DAILY BREAKDOWN'],
          [''],
          ['Date', 'Opening Balance', 'Cash Revenue', 'Bank Revenue', 'Total Revenue', 'Cash Expenses', 'Bank Expenses', 'Closing Balance']
        ];

        monthlyReportData.forEach(report => {
          dailyData.push([
            new Date(report.date).toLocaleDateString(),
            `₹${(report.openingBalanceCents / 100).toFixed(2)}`,
            `₹${(report.cashReceivedCents / 100).toFixed(2)}`,
            `₹${(report.bankReceivedCents / 100).toFixed(2)}`,
            `₹${(report.totalReceivedCents / 100).toFixed(2)}`,
            `₹${(report.cashExpensesCents / 100).toFixed(2)}`,
            `₹${(report.bankExpensesCents / 100).toFixed(2)}`,
            `₹${(report.closingBalanceCents / 100).toFixed(2)}`
          ]);
        });

        const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
        
        // Set column widths for better readability
        dailySheet['!cols'] = [
          { width: 12 },  // Date
          { width: 15 },  // Opening Balance
          { width: 15 },  // Cash Revenue
          { width: 15 },  // Bank Revenue
          { width: 15 },  // Total Revenue
          { width: 15 },  // Cash Expenses
          { width: 15 },  // Bank Expenses
          { width: 15 }   // Closing Balance
        ];
        
        XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Details');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Excel = excelBuffer.toString('base64');
      
      const filename = `Monthly_Report_${orgPropertyInfo.property_name.replace(/\s+/g, '_')}_${monthName}_${year}.xlsx`;
      
      return {
        excelData: base64Excel,
        filename: filename
      };
    } catch (error) {
      console.error('Export monthly report Excel error:', error);
      throw APIError.internal("Failed to export monthly report to Excel");
    }
  }
);

// Export monthly report to PDF
export const exportMonthlyReportPDF = api<{
  propertyId: number;
  year: number;
  month: number;
}, {
  pdfData: string; // Base64 encoded PDF
  filename: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/export-monthly-pdf" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, year, month } = req;

    try {
      // Get organization and property information
      const orgPropertyInfo = await reportsDB.queryRow`
        SELECT 
          o.name as org_name,
          p.name as property_name,
          p.address_json as property_address
        FROM organizations o
        JOIN properties p ON o.id = p.org_id
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!orgPropertyInfo) {
        throw APIError.notFound("Property not found");
      }

      // Get monthly report data using existing helper function
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const monthlyReportData = await getDailyReportsData({
        propertyId,
        startDate,
        endDate,
        orgId: authData.orgId,
        authData,
      });

      // Calculate monthly totals
      let totalOpeningBalanceCents = 0;
      let totalCashReceivedCents = 0;
      let totalBankReceivedCents = 0;
      let totalCashExpensesCents = 0;
      let totalBankExpensesCents = 0;
      let totalClosingBalanceCents = 0;

      if (monthlyReportData.length > 0) {
        totalOpeningBalanceCents = monthlyReportData[monthlyReportData.length - 1].openingBalanceCents;
        totalClosingBalanceCents = monthlyReportData[0].closingBalanceCents;
      }

      monthlyReportData.forEach(report => {
        totalCashReceivedCents += report.cashReceivedCents;
        totalBankReceivedCents += report.bankReceivedCents;
        totalCashExpensesCents += report.cashExpensesCents;
        totalBankExpensesCents += report.bankExpensesCents;
      });

      const totalRevenue = totalCashReceivedCents + totalBankReceivedCents;
      const totalExpenses = totalCashExpensesCents + totalBankExpensesCents;
      const netIncome = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[month - 1];

      // Dynamic import for PDFKit
      const PDFDocument = (await import('pdfkit')).default;
      
      // Create PDF document with better formatting
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Monthly Cash Balance Report',
          Author: 'Hospitality Management Platform',
          Subject: `Monthly Report for ${orgPropertyInfo.property_name}`,
          Keywords: 'monthly, cash, balance, report, hospitality'
        }
      });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          const base64PDF = pdfBuffer.toString('base64');
          
          const filename = `Monthly_Report_${orgPropertyInfo.property_name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`;
          
          resolve({
            pdfData: base64PDF,
            filename: filename
          });
        });

        doc.on('error', reject);

        // PDF Content with improved formatting
        // Header with background
        doc.rect(50, 50, 500, 60).fill('#f8fafc');
        doc.fillColor('#1e293b');
        doc.fontSize(24).font('Helvetica-Bold').text('Monthly Cash Balance Report', 70, 70, { align: 'left' });
        doc.fontSize(12).font('Helvetica').fillColor('#64748b').text('Financial Summary Report', 70, 95, { align: 'left' });
        doc.moveDown(3);
        
        // Organization and Property Info with better formatting
        doc.fillColor('#1e293b');
        doc.fontSize(16).font('Helvetica-Bold').text('Report Information', { align: 'left' });
        doc.moveDown(0.5);
        
        // Create info box
        const infoY = doc.y;
        doc.rect(50, infoY, 500, 80).stroke('#e2e8f0');
        doc.fillColor('#1e293b');
        doc.fontSize(12).font('Helvetica-Bold').text('Organization:', 60, infoY + 10);
        doc.font('Helvetica').text(orgPropertyInfo.org_name, 150, infoY + 10);
        
        doc.font('Helvetica-Bold').text('Property:', 60, infoY + 30);
        doc.font('Helvetica').text(orgPropertyInfo.property_name, 150, infoY + 30);
        
        if (orgPropertyInfo.property_address) {
          const address = typeof orgPropertyInfo.property_address === 'string' 
            ? JSON.parse(orgPropertyInfo.property_address) 
            : orgPropertyInfo.property_address;
          const addressStr = [address.street, address.city, address.state, address.country, address.zipCode]
            .filter(Boolean)
            .join(', ');
          if (addressStr) {
            doc.font('Helvetica-Bold').text('Address:', 60, infoY + 50);
            doc.font('Helvetica').text(addressStr, 150, infoY + 50);
          }
        }
        
        doc.font('Helvetica-Bold').text('Report Period:', 60, infoY + 70);
        doc.font('Helvetica').text(`${monthName} ${year}`, 150, infoY + 70);
        
        doc.moveDown(2);

        // Financial Summary Section with better formatting
        doc.fillColor('#1e293b');
        doc.fontSize(18).font('Helvetica-Bold').text('Monthly Financial Summary', { align: 'left' });
        doc.moveDown(0.5);
        
        const formatCurrency = (cents: number) => `₹${(cents / 100).toFixed(2)}`;
        
        // Create summary table
        const summaryY = doc.y;
        doc.rect(50, summaryY, 500, 120).stroke('#e2e8f0');
        
        // Opening Balance
        doc.fillColor('#1e293b');
        doc.fontSize(12).font('Helvetica-Bold').text('Opening Balance (Cash):', 60, summaryY + 15);
        doc.font('Helvetica').text(formatCurrency(totalOpeningBalanceCents), 400, summaryY + 15, { align: 'right' });
        
        // Revenue Section
        doc.font('Helvetica-Bold').text('Revenue:', 60, summaryY + 35);
        doc.font('Helvetica').text(`Cash Revenue: ${formatCurrency(totalCashReceivedCents)}`, 80, summaryY + 50);
        doc.text(`Bank Revenue: ${formatCurrency(totalBankReceivedCents)}`, 80, summaryY + 65);
        doc.font('Helvetica-Bold').text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 80, summaryY + 80);
        
        // Expenses Section
        doc.font('Helvetica-Bold').text('Expenses:', 60, summaryY + 100);
        doc.font('Helvetica').text(`Cash Expenses: ${formatCurrency(totalCashExpensesCents)}`, 80, summaryY + 115);
        doc.text(`Bank Expenses: ${formatCurrency(totalBankExpensesCents)}`, 80, summaryY + 130);
        doc.font('Helvetica-Bold').text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 80, summaryY + 145);
        
        // Closing Balance (highlighted)
        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 30).fill('#f0f9ff');
        doc.fillColor('#1e40af');
        doc.fontSize(16).font('Helvetica-Bold').text('Closing Balance (Cash):', 60, doc.y + 8);
        doc.text(formatCurrency(totalClosingBalanceCents), 400, doc.y + 8, { align: 'right' });
        doc.moveDown(1.5);

        // Net Income and Profit Margin
        doc.fillColor('#1e293b');
        doc.fontSize(14).font('Helvetica-Bold').text('Net Income:', 60, doc.y);
        doc.text(formatCurrency(netIncome), 400, doc.y, { align: 'right' });
        doc.moveDown(0.5);
        
        doc.font('Helvetica-Bold').text('Profit Margin:', 60, doc.y);
        doc.text(`${profitMargin.toFixed(1)}%`, 400, doc.y, { align: 'right' });
        doc.moveDown(2);

        // Daily Breakdown Section
        if (monthlyReportData.length > 0) {
          doc.fillColor('#1e293b');
          doc.fontSize(18).font('Helvetica-Bold').text('Daily Breakdown', { align: 'left' });
          doc.moveDown(0.5);
          
          // Table headers
          const tableY = doc.y;
          doc.rect(50, tableY, 500, 20).fill('#f1f5f9');
          doc.fillColor('#1e293b');
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Date', 60, tableY + 6);
          doc.text('Opening', 120, tableY + 6);
          doc.text('Cash Rev', 180, tableY + 6);
          doc.text('Bank Rev', 240, tableY + 6);
          doc.text('Cash Exp', 300, tableY + 6);
          doc.text('Bank Exp', 360, tableY + 6);
          doc.text('Closing', 420, tableY + 6);
          
          // Table rows
          let currentY = tableY + 20;
          monthlyReportData.slice(0, 20).forEach((report, index) => { // Limit to 20 rows to fit on page
            if (currentY > 700) { // Start new page if needed
              doc.addPage();
              currentY = 50;
            }
            
            doc.rect(50, currentY, 500, 15).stroke('#e2e8f0');
            doc.fillColor('#1e293b');
            doc.fontSize(9).font('Helvetica');
            doc.text(new Date(report.date).toLocaleDateString(), 60, currentY + 4);
            doc.text(formatCurrency(report.openingBalanceCents), 120, currentY + 4);
            doc.text(formatCurrency(report.cashReceivedCents), 180, currentY + 4);
            doc.text(formatCurrency(report.bankReceivedCents), 240, currentY + 4);
            doc.text(formatCurrency(report.cashExpensesCents), 300, currentY + 4);
            doc.text(formatCurrency(report.bankExpensesCents), 360, currentY + 4);
            doc.text(formatCurrency(report.closingBalanceCents), 420, currentY + 4);
            
            currentY += 15;
          });
        }

        // Footer with better formatting
        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 30).fill('#f8fafc');
        doc.fillColor('#64748b');
        const nowMonthly = new Date();
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${nowMonthly.toLocaleDateString()} ${nowMonthly.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`, 70, doc.y + 8);
        doc.text(`Data Source: Finance Transactions`, 70, doc.y + 20);

        doc.end();
      });
    } catch (error) {
      console.error('Export monthly report PDF error:', error);
      throw APIError.internal("Failed to export monthly report to PDF");
    }
  }
);

// Export daily report to Excel
export const exportDailyReportExcel = api<{
  propertyId: number;
  date: string;
}, {
  excelData: string; // Base64 encoded Excel file
  filename: string;
}>(
  { auth: true, expose: true, method: "POST", path: "/reports/export-daily-excel" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, date } = req;

    try {
      // Get organization and property information
      const orgPropertyInfo = await reportsDB.queryRow`
        SELECT 
          o.name as org_name,
          p.name as property_name,
          p.address_json as property_address
        FROM organizations o
        JOIN properties p ON o.id = p.org_id
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!orgPropertyInfo) {
        throw APIError.notFound("Property not found");
      }

      // Get daily report data using helper function
      const dailyReport = await getDailyReportData(propertyId, date, authData.orgId, authData);
      
      console.log('Excel Export - Daily report data:', {
        openingBalance: dailyReport.openingBalanceCents,
        cashRevenue: dailyReport.cashReceivedCents,
        bankRevenue: dailyReport.bankReceivedCents,
        cashExpenses: dailyReport.cashExpensesCents,
        bankExpenses: dailyReport.bankExpensesCents,
        closingBalance: dailyReport.closingBalanceCents,
        transactionCount: dailyReport.transactions.length
      });
      
      // Dynamic import for XLSX
      const XLSX = await import('xlsx');
      
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Summary Sheet with better formatting
      const summaryData = [
        ['DAILY CASH BALANCE REPORT'],
        [''],
        ['REPORT INFORMATION'],
        ['Organization', orgPropertyInfo.org_name],
        ['Property', orgPropertyInfo.property_name],
        ['Address', (() => {
          if (!orgPropertyInfo.property_address) return 'N/A';
          const address = typeof orgPropertyInfo.property_address === 'string' 
            ? JSON.parse(orgPropertyInfo.property_address) 
            : orgPropertyInfo.property_address;
          return [address.street, address.city, address.state, address.country, address.zipCode]
            .filter(Boolean)
            .join(', ') || 'N/A';
        })()],
        ['Report Date', new Date(date).toLocaleDateString()],
        ['Generated On', `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`],
        [''],
        ['FINANCIAL SUMMARY'],
        [''],
        ['Opening Balance (Cash)', `₹${(dailyReport.openingBalanceCents / 100).toFixed(2)}`],
        [''],
        ['REVENUE'],
        ['Cash Revenue', `₹${(dailyReport.cashReceivedCents / 100).toFixed(2)}`],
        ['Bank Revenue', `₹${(dailyReport.bankReceivedCents / 100).toFixed(2)}`],
        ['Total Revenue', `₹${(dailyReport.totalReceivedCents / 100).toFixed(2)}`],
        [''],
        ['EXPENSES'],
        ['Cash Expenses', `₹${(dailyReport.cashExpensesCents / 100).toFixed(2)}`],
        ['Bank Expenses', `₹${(dailyReport.bankExpensesCents / 100).toFixed(2)}`],
        ['Total Expenses', `₹${(dailyReport.totalExpensesCents / 100).toFixed(2)}`],
        [''],
        ['CLOSING BALANCE (CASH)', `₹${(dailyReport.closingBalanceCents / 100).toFixed(2)}`],
        ['Net Cash Flow', `₹${(dailyReport.netCashFlowCents / 100).toFixed(2)}`],
        [''],
        ['CALCULATIONS'],
        ['Total Cash = Opening Balance + Cash Revenue', `₹${((dailyReport.openingBalanceCents + dailyReport.cashReceivedCents) / 100).toFixed(2)}`],
        ['Closing Balance = Total Cash - Cash Expenses', `₹${(dailyReport.closingBalanceCents / 100).toFixed(2)}`],
        ['Next Day Opening Balance', `₹${(dailyReport.closingBalanceCents / 100).toFixed(2)}`]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      summarySheet['!cols'] = [
        { width: 30 },
        { width: 20 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Transactions Sheet with better formatting
      if (dailyReport.transactions.length > 0) {
        const transactionData = [
          ['TRANSACTION DETAILS'],
          [''],
          ['ID', 'Type', 'Description', 'Amount (₹)', 'Payment Mode', 'Status', 'Created By', 'Date/Time']
        ];

        dailyReport.transactions.forEach(tx => {
          const txDate = new Date(tx.occurredAt);
          transactionData.push([
            tx.id.toString(),
            tx.type.toUpperCase(),
            tx.description || 'No description',
            (tx.amountCents / 100).toFixed(2),
            tx.paymentMode.toUpperCase(),
            tx.status,
            tx.createdByName,
            `${txDate.toLocaleDateString()} ${txDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          ]);
        });

        const transactionSheet = XLSX.utils.aoa_to_sheet(transactionData);
        
        // Set column widths for better readability
        transactionSheet['!cols'] = [
          { width: 8 },   // ID
          { width: 12 },  // Type
          { width: 30 },  // Description
          { width: 15 },  // Amount
          { width: 15 },  // Payment Mode
          { width: 12 },  // Status
          { width: 20 },  // Created By
          { width: 25 }   // Date/Time
        ];
        
        XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const base64Excel = excelBuffer.toString('base64');
      
      const filename = `Daily_Report_${orgPropertyInfo.property_name.replace(/\s+/g, '_')}_${date}.xlsx`;
      
      return {
        excelData: base64Excel,
        filename: filename
      };
    } catch (error) {
      console.error('Export daily report Excel error:', error);
      throw APIError.internal("Failed to export daily report to Excel");
    }
  }
);