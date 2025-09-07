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
