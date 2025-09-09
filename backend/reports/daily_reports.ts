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
    // Get previous day's closing balance
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    const previousBalance = await reportsDB.queryRow`
      SELECT closing_balance_cents 
      FROM daily_cash_balances 
      WHERE org_id = ${orgId} 
        AND property_id = ${propertyId} 
        AND balance_date = ${previousDateStr}
    `;
    
    return previousBalance?.closing_balance_cents || 0;
  } catch (error) {
    console.error('Error calculating opening balance:', error);
    return 0; // Default to 0 if calculation fails
  }
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
      AND r.occurred_at >= $${propertyParams.length + 2}::date 
      AND r.occurred_at < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
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
      AND e.expense_date >= $${propertyParams.length + 4}::date 
      AND e.expense_date < ($${propertyParams.length + 4}::date + INTERVAL '1 day')
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

      // Add debugging before query execution
      console.log('Daily report property filter debug:', {
        propertyId,
        propertyFilter,
        propertyParams,
        orgId: authData.orgId,
        date,
        totalParams: [...propertyParams, authData.orgId, date]
      });

      // Add query validation
      const expectedParamCount = propertyParams.length + 2; // +2 for orgId and date
      const actualParamCount = (cashBalanceQuery.match(/\$/g) || []).length;
      if (expectedParamCount !== actualParamCount) {
        console.error(`Parameter count mismatch: expected ${expectedParamCount}, found ${actualParamCount}`);
        throw new Error(`Parameter count mismatch: expected ${expectedParamCount}, found ${actualParamCount}`);
      }

      const cashBalanceResult = await reportsDB.rawQueryRow(
        cashBalanceQuery, 
        ...propertyParams, 
        authData.orgId, 
        date
      );

      // Get all APPROVED transactions for the date - using date range like Finance system
      const transactionsQuery = `
        SELECT 
          r.id, 'revenue' as type, r.property_id, p.name as property_name,
          r.amount_cents, r.payment_mode, r.bank_reference, r.description,
          r.source, r.occurred_at, u.display_name as created_by_name, r.status
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1} 
          AND r.occurred_at >= $${propertyParams.length + 2}::date 
          AND r.occurred_at < ($${propertyParams.length + 2}::date + INTERVAL '1 day')
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
          AND e.expense_date >= $${propertyParams.length + 4}::date 
          AND e.expense_date < ($${propertyParams.length + 4}::date + INTERVAL '1 day')
          AND e.status = 'approved'
          ${propertyFilter}
        
        ORDER BY occurred_at DESC
      `;

      // Add debugging for transactions query
      console.log('Daily report transactions query debug:', {
        propertyId,
        propertyFilter,
        propertyParams,
        orgId: authData.orgId,
        date,
        totalParams: [...propertyParams, authData.orgId, date, authData.orgId, date]
      });

      // Add query validation for transactions
      const expectedTransactionParamCount = propertyParams.length + 4; // +4 for orgId, date, orgId, date
      const actualTransactionParamCount = (transactionsQuery.match(/\$/g) || []).length;
      if (expectedTransactionParamCount !== actualTransactionParamCount) {
        console.error(`Transaction parameter count mismatch: expected ${expectedTransactionParamCount}, found ${actualTransactionParamCount}`);
        throw new Error(`Transaction parameter count mismatch: expected ${expectedTransactionParamCount}, found ${actualTransactionParamCount}`);
      }

      const transactions = await reportsDB.rawQueryAll(
        transactionsQuery, 
        ...propertyParams, 
        authData.orgId, 
        date,
        authData.orgId, 
        date
      );

      console.log(`Daily report for ${date}: Found ${transactions.length} approved transactions`);
      if (transactions.length > 0) {
        console.log('Transaction details:', transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount_cents,
          paymentMode: tx.payment_mode,
          status: tx.status
        })));
      }

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
          openingBalanceCents = await calculateOpeningBalance(propertyId, date, authData.orgId);
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

      // Get all APPROVED transactions for the date range - using date range like Finance system
      const transactionsQuery = `
        SELECT 
          r.id, 'revenue' as type, r.property_id, p.name as property_name,
          r.amount_cents, r.payment_mode, r.bank_reference, r.description,
          r.source, r.occurred_at, u.display_name as created_by_name, r.status
        FROM revenues r
        JOIN properties p ON r.property_id = p.id
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.org_id = $${propertyParams.length + 1} 
          AND r.occurred_at >= $${propertyParams.length + 2}::date 
          AND r.occurred_at <= $${propertyParams.length + 3}::date + INTERVAL '1 day' - INTERVAL '1 second'
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
          AND e.expense_date >= $${propertyParams.length + 5}::date 
          AND e.expense_date <= $${propertyParams.length + 6}::date + INTERVAL '1 day' - INTERVAL '1 second'
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
      const expectedTransactionParamCount = propertyParams.length + 6; // +6 for orgId, startDate, endDate, orgId, startDate, endDate
      const actualTransactionParamCount = (transactionsQuery.match(/\$/g) || []).length;
      if (expectedTransactionParamCount !== actualTransactionParamCount) {
        console.error(`Transaction parameter count mismatch: expected ${expectedTransactionParamCount}, found ${actualTransactionParamCount}`);
        throw new Error(`Transaction parameter count mismatch: expected ${expectedTransactionParamCount}, found ${actualTransactionParamCount}`);
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
        const date = tx.occurred_at.split('T')[0];
        if (!transactionsByDate.has(date)) {
          transactionsByDate.set(date, []);
        }
        transactionsByDate.get(date)!.push(tx);
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
        doc.font('Helvetica').text(new Date(date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }), 150, infoY + 70);
        
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
            doc.text(new Date(tx.occurredAt).toLocaleString(), 450, txY + 35, { align: 'right' });
            
            doc.moveDown(1.2);
          });
        }

        // Footer with better formatting
        doc.moveDown(2);
        doc.rect(50, doc.y, 500, 30).fill('#f8fafc');
        doc.fillColor('#64748b');
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, 70, doc.y + 8);
        doc.text(`Data Source: Finance Transactions`, 70, doc.y + 20);

        doc.end();
      });
    } catch (error) {
      console.error('Export daily report PDF error:', error);
      throw APIError.internal("Failed to export daily report to PDF");
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
        ['Report Date', new Date(date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })],
        ['Generated On', new Date().toLocaleString()],
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
          transactionData.push([
            tx.id.toString(),
            tx.type.toUpperCase(),
            tx.description || 'No description',
            (tx.amountCents / 100).toFixed(2),
            tx.paymentMode.toUpperCase(),
            tx.status,
            tx.createdByName,
            new Date(tx.occurredAt).toLocaleString()
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