import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { financeEvents } from "./events";
import { v4 as uuidv4 } from 'uuid';

export interface DailyApprovalStatsRequest {
  date?: string; // YYYY-MM-DD format, defaults to today
}

export interface DailyApprovalStatsResponse {
  success: boolean;
  date: string;
  stats: {
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    totalAmount: {
      pending: number;
      approved: number;
      rejected: number;
    };
    byType: {
      revenues: {
        pending: number;
        approved: number;
        rejected: number;
        amount: number;
      };
      expenses: {
        pending: number;
        approved: number;
        rejected: number;
        amount: number;
      };
    };
  };
  transactions: {
    revenues: Array<{
      id: number;
      propertyName: string;
      source: string;
      amountCents: number;
      description?: string;
      status: string;
      createdByName: string;
      createdAt: Date;
      paymentMode: string;
    }>;
    expenses: Array<{
      id: number;
      propertyName: string;
      category: string;
      amountCents: number;
      description?: string;
      status: string;
      createdByName: string;
      createdAt: Date;
      paymentMode: string;
    }>;
  };
}

// Shared handler for daily approval stats (used by both legacy and v1 endpoints)
async function getDailyApprovalStatsHandler(req: DailyApprovalStatsRequest): Promise<DailyApprovalStatsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

  const { date } = req || {};
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if status columns exist in both tables
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Both tables must have the status column
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    try {
      // Get revenue statistics
      let revenueStats;
      if (hasStatusColumns) {
        revenueStats = await financeDB.queryRow`
          SELECT 
            COUNT(*) as total_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_cents ELSE 0 END), 0) as approved_amount,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_cents ELSE 0 END), 0) as rejected_amount
          FROM revenues r
          JOIN properties p ON r.property_id = p.id
          WHERE r.org_id = ${authData.orgId}
          AND r.created_at >= ${startOfDay}
          AND r.created_at <= ${endOfDay}
        `;
      } else {
        // Fallback: assume all revenues are pending if no status column
        revenueStats = await financeDB.queryRow`
          SELECT 
            COUNT(*) as total_count,
            COUNT(*) as pending_count,
            0 as approved_count,
            0 as rejected_count,
            COALESCE(SUM(amount_cents), 0) as pending_amount,
            0 as approved_amount,
            0 as rejected_amount
          FROM revenues r
          JOIN properties p ON r.property_id = p.id
          WHERE r.org_id = ${authData.orgId}
          AND r.created_at >= ${startOfDay}
          AND r.created_at <= ${endOfDay}
        `;
      }

      // Get expense statistics
      let expenseStats;
      if (hasStatusColumns) {
        expenseStats = await financeDB.queryRow`
          SELECT 
            COUNT(*) as total_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_cents ELSE 0 END), 0) as approved_amount,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_cents ELSE 0 END), 0) as rejected_amount
          FROM expenses e
          JOIN properties p ON e.property_id = p.id
          WHERE e.org_id = ${authData.orgId}
          AND e.created_at >= ${startOfDay}
          AND e.created_at <= ${endOfDay}
        `;
      } else {
        // Fallback: assume all expenses are pending if no status column
        expenseStats = await financeDB.queryRow`
          SELECT 
            COUNT(*) as total_count,
            COUNT(*) as pending_count,
            0 as approved_count,
            0 as rejected_count,
            COALESCE(SUM(amount_cents), 0) as pending_amount,
            0 as approved_amount,
            0 as rejected_amount
          FROM expenses e
          JOIN properties p ON e.property_id = p.id
          WHERE e.org_id = ${authData.orgId}
          AND e.created_at >= ${startOfDay}
          AND e.created_at <= ${endOfDay}
        `;
      }

      // Get detailed revenue transactions
      let revenueTransactions;
      if (hasStatusColumns) {
        revenueTransactions = await financeDB.queryAll`
          SELECT 
            r.id,
            p.name as property_name,
            r.source,
            r.amount_cents,
            r.description,
            r.status,
            u.display_name as created_by_name,
            r.created_at,
            r.payment_mode
          FROM revenues r
          JOIN properties p ON r.property_id = p.id
          JOIN users u ON r.created_by_user_id = u.id
          WHERE r.org_id = ${authData.orgId}
          AND r.created_at >= ${startOfDay}
          AND r.created_at <= ${endOfDay}
          ORDER BY r.created_at DESC
        `;
      } else {
        // Fallback: select without status column
        revenueTransactions = await financeDB.queryAll`
          SELECT 
            r.id,
            p.name as property_name,
            r.source,
            r.amount_cents,
            r.description,
            'pending' as status,
            u.display_name as created_by_name,
            r.created_at,
            'cash' as payment_mode
          FROM revenues r
          JOIN properties p ON r.property_id = p.id
          JOIN users u ON r.created_by_user_id = u.id
          WHERE r.org_id = ${authData.orgId}
          AND r.created_at >= ${startOfDay}
          AND r.created_at <= ${endOfDay}
          ORDER BY r.created_at DESC
        `;
      }

      // Get detailed expense transactions
      let expenseTransactions;
      if (hasStatusColumns) {
        expenseTransactions = await financeDB.queryAll`
          SELECT 
            e.id,
            p.name as property_name,
            e.category,
            e.amount_cents,
            e.description,
            e.status,
            u.display_name as created_by_name,
            e.created_at,
            e.payment_mode
          FROM expenses e
          JOIN properties p ON e.property_id = p.id
          JOIN users u ON e.created_by_user_id = u.id
          WHERE e.org_id = ${authData.orgId}
          AND e.created_at >= ${startOfDay}
          AND e.created_at <= ${endOfDay}
          ORDER BY e.created_at DESC
        `;
      } else {
        // Fallback: select without status column
        expenseTransactions = await financeDB.queryAll`
          SELECT 
            e.id,
            p.name as property_name,
            e.category,
            e.amount_cents,
            e.description,
            'pending' as status,
            u.display_name as created_by_name,
            e.created_at,
            'cash' as payment_mode
          FROM expenses e
          JOIN properties p ON e.property_id = p.id
          JOIN users u ON e.created_by_user_id = u.id
          WHERE e.org_id = ${authData.orgId}
          AND e.created_at >= ${startOfDay}
          AND e.created_at <= ${endOfDay}
          ORDER BY e.created_at DESC
        `;
      }

      const totalPending = (revenueStats?.pending_count || 0) + (expenseStats?.pending_count || 0);
      const totalApproved = (revenueStats?.approved_count || 0) + (expenseStats?.approved_count || 0);
      const totalRejected = (revenueStats?.rejected_count || 0) + (expenseStats?.rejected_count || 0);

      return {
        success: true,
        date: targetDate.toISOString().split('T')[0],
        stats: {
          totalPending,
          totalApproved,
          totalRejected,
          totalAmount: {
            pending: (revenueStats?.pending_amount || 0) + (expenseStats?.pending_amount || 0),
            approved: (revenueStats?.approved_amount || 0) + (expenseStats?.approved_amount || 0),
            rejected: (revenueStats?.rejected_amount || 0) + (expenseStats?.rejected_amount || 0),
          },
          byType: {
            revenues: {
              pending: revenueStats?.pending_count || 0,
              approved: revenueStats?.approved_count || 0,
              rejected: revenueStats?.rejected_count || 0,
              amount: (revenueStats?.pending_amount || 0) + (revenueStats?.approved_amount || 0) + (revenueStats?.rejected_amount || 0),
            },
            expenses: {
              pending: expenseStats?.pending_count || 0,
              approved: expenseStats?.approved_count || 0,
              rejected: expenseStats?.rejected_count || 0,
              amount: (expenseStats?.pending_amount || 0) + (expenseStats?.approved_amount || 0) + (expenseStats?.rejected_amount || 0),
            },
          },
        },
        transactions: {
          revenues: revenueTransactions.map((r: any) => ({
            id: r.id,
            propertyName: r.property_name,
            source: r.source,
            amountCents: r.amount_cents,
            description: r.description,
            status: r.status,
            createdByName: r.created_by_name,
            createdAt: r.created_at,
            paymentMode: r.payment_mode,
          })),
          expenses: expenseTransactions.map((e: any) => ({
            id: e.id,
            propertyName: e.property_name,
            category: e.category,
            amountCents: e.amount_cents,
            description: e.description,
            status: e.status,
            createdByName: e.created_by_name,
            createdAt: e.created_at,
            paymentMode: e.payment_mode,
          })),
        },
      };
    } catch (error) {
      console.error('Error getting daily approval stats:', error);
      throw APIError.internal(`Failed to get daily approval statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Get daily approval statistics and transactions (keep for backward compatibility)
export const getDailyApprovalStats = api<DailyApprovalStatsRequest, DailyApprovalStatsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/daily-approval-stats" },
  getDailyApprovalStatsHandler
);

// V1: Get daily approval statistics and transactions
export const getDailyApprovalStatsV1 = api<DailyApprovalStatsRequest, DailyApprovalStatsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/daily-approval-stats" },
  getDailyApprovalStatsHandler
);

export interface BulkApproveRequest {
  transactionIds: number[];
  transactionType: 'revenue' | 'expense' | 'all';
  action: 'approve' | 'reject';
  date?: string; // YYYY-MM-DD format, defaults to today
}

export interface BulkApproveResponse {
  success: boolean;
  message: string;
  results: {
    approved: number;
    rejected: number;
    failed: number;
    errors: string[];
  };
}

// Shared handler for bulk approve/reject (used by both legacy and v1 endpoints)
async function bulkApproveTransactionsHandler(req: BulkApproveRequest): Promise<BulkApproveResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

  const { transactionIds, transactionType, action } = req;

    if (!transactionIds || transactionIds.length === 0) {
      throw APIError.invalidArgument("No transaction IDs provided");
    }

    try {
      const tx = await financeDB.begin();
      let approved = 0;
      let rejected = 0;
      let failed = 0;
      const errors: string[] = [];

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const currentTime = new Date();

      for (const transactionId of transactionIds) {
        try {
          // Update revenues if applicable
          if (transactionType === 'revenue' || transactionType === 'all') {
            // Check if revenue exists and is pending first
            const revenueExists = await tx.queryRow`
              SELECT id FROM revenues 
              WHERE id = ${transactionId} 
              AND org_id = ${authData.orgId}
              AND status = 'pending'
            `;
            
            if (revenueExists) {
              await tx.exec`
                UPDATE revenues 
                SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = ${currentTime}
                WHERE id = ${transactionId} 
                AND org_id = ${authData.orgId}
                AND status = 'pending'
              `;
              
              if (action === 'approve') approved++;
              else rejected++;
              continue;
            }
          }

          // Update expenses if applicable
          if (transactionType === 'expense' || transactionType === 'all') {
            // Check if expense exists and is pending first
            const expenseExists = await tx.queryRow`
              SELECT id FROM expenses 
              WHERE id = ${transactionId} 
              AND org_id = ${authData.orgId}
              AND status = 'pending'
            `;
            
            if (expenseExists) {
              await tx.exec`
                UPDATE expenses 
                SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = ${currentTime}
                WHERE id = ${transactionId} 
                AND org_id = ${authData.orgId}
                AND status = 'pending'
              `;
              
              if (action === 'approve') approved++;
              else rejected++;
              continue;
            }
          }

          // If we get here, the transaction wasn't found or already processed
          failed++;
          errors.push(`Transaction ${transactionId} not found or already processed`);
        } catch (error) {
          failed++;
          errors.push(`Failed to process transaction ${transactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      await tx.commit();

      // Publish event for real-time updates
      await financeEvents.publish({
        eventId: uuidv4(),
        eventVersion: 'v1',
        eventType: 'daily_approval_granted', // Valid event type from schema
        orgId: authData.orgId,
        propertyId: 0, // Bulk operation across properties
        entityId: 0, // Bulk operation
        entityType: 'daily_approval',
        userId: parseInt(authData.userID),
        timestamp: new Date(),
        metadata: {
          count: approved + rejected,
          approved,
          rejected,
        },
      });

      return {
        success: true,
        message: `Bulk ${action} completed: ${approved} approved, ${rejected} rejected, ${failed} failed`,
        results: {
          approved,
          rejected,
          failed,
          errors,
        },
      };
    } catch (error) {
      console.error('Error in bulk approve:', error);
      throw APIError.internal(`Failed to bulk ${action} transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Bulk approve or reject transactions (keep for backward compatibility)
export const bulkApproveTransactions = api<BulkApproveRequest, BulkApproveResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/bulk-approve" },
  bulkApproveTransactionsHandler
);

// V1: Bulk approve or reject transactions
export const bulkApproveTransactionsV1 = api<BulkApproveRequest, BulkApproveResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/bulk-approve" },
  bulkApproveTransactionsHandler
);

export interface DailyApprovalSummaryRequest {
  startDate?: string;
  endDate?: string;
}

export interface DailyApprovalSummaryResponse {
  success: boolean;
  summary: Array<{
    date: string;
    totalTransactions: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    pendingAmount: number;
    approvedAmount: number;
    rejectedAmount: number;
  }>;
}

export interface TodayPendingTransactionsRequest {
  date?: string;
  propertyId?: number;
  startDate?: string;
  endDate?: string;
}

export interface TodayPendingTransactionsResponse {
  success: boolean;
  transactions: Array<{
    id: number;
    type: 'revenue' | 'expense';
    category?: string;
    source?: string;
    amountCents: number;
    description?: string;
    propertyName: string;
    createdByName: string;
    createdAt: Date;
    status: string;
    paymentMode: string;
    bankReference?: string;
    receiptUrl?: string;
  }>;
}

// Shared handler for daily approval summary (used by both legacy and v1 endpoints)
async function getDailyApprovalSummaryHandler(req: DailyApprovalSummaryRequest): Promise<DailyApprovalSummaryResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

  const { startDate, endDate } = req || {};
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
    const end = endDate ? new Date(endDate) : new Date();

    // Check if status columns exist in both tables
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Both tables must have the status column
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    try {
      let summary;
      if (hasStatusColumns) {
        summary = await financeDB.queryAll`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as pending_amount,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_cents ELSE 0 END), 0) as approved_amount,
            COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount_cents ELSE 0 END), 0) as rejected_amount
          FROM (
            SELECT created_at, status, amount_cents FROM revenues WHERE org_id = ${authData.orgId}
            UNION ALL
            SELECT created_at, status, amount_cents FROM expenses WHERE org_id = ${authData.orgId}
          ) as all_transactions
          WHERE created_at >= ${start} AND created_at <= ${end}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
        `;
      } else {
        // Fallback: assume all transactions are pending if no status column
        summary = await financeDB.queryAll`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_transactions,
            COUNT(*) as pending_count,
            0 as approved_count,
            0 as rejected_count,
            COALESCE(SUM(amount_cents), 0) as pending_amount,
            0 as approved_amount,
            0 as rejected_amount
          FROM (
            SELECT created_at, amount_cents FROM revenues WHERE org_id = ${authData.orgId}
            UNION ALL
            SELECT created_at, amount_cents FROM expenses WHERE org_id = ${authData.orgId}
          ) as all_transactions
          WHERE created_at >= ${start} AND created_at <= ${end}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
        `;
      }

      return {
        success: true,
        summary: summary.map((row: any) => ({
          date: row.date,
          totalTransactions: parseInt(row.total_transactions),
          pendingCount: parseInt(row.pending_count),
          approvedCount: parseInt(row.approved_count),
          rejectedCount: parseInt(row.rejected_count),
          pendingAmount: parseInt(row.pending_amount),
          approvedAmount: parseInt(row.approved_amount),
          rejectedAmount: parseInt(row.rejected_amount),
        })),
      };
    } catch (error) {
      console.error('Error getting daily approval summary:', error);
      throw APIError.internal(`Failed to get daily approval summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Get daily approval summary for a date range (keep for backward compatibility)
export const getDailyApprovalSummary = api<DailyApprovalSummaryRequest, DailyApprovalSummaryResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/daily-approval-summary" },
  getDailyApprovalSummaryHandler
);

// V1: Get daily approval summary for a date range
export const getDailyApprovalSummaryV1 = api<DailyApprovalSummaryRequest, DailyApprovalSummaryResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/daily-approval-summary" },
  getDailyApprovalSummaryHandler
);

// Shared handler for today's pending transactions (used by both legacy and v1 endpoints)
async function getTodayPendingTransactionsHandler(req: TodayPendingTransactionsRequest): Promise<TodayPendingTransactionsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

  const { date, propertyId, startDate, endDate } = req || {};

  // Date filtering is now handled directly in the SQL queries below

    try {
      // Single optimized query using UNION ALL to get both revenues and expenses in one go
      // This eliminates the need for multiple queries and schema checking
      let transactions;
      if (propertyId) {
        // Use template literals with proper parameter binding
        if (startDate && endDate) {
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND DATE(r.created_at) BETWEEN ${startDate} AND ${endDate}
                AND COALESCE(r.status, 'pending') = 'pending'
                AND r.property_id = ${propertyId}
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND DATE(e.created_at) BETWEEN ${startDate} AND ${endDate}
                AND COALESCE(e.status, 'pending') = 'pending'
                AND e.property_id = ${propertyId}
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        } else if (date) {
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND DATE(r.created_at) = ${date}
                AND COALESCE(r.status, 'pending') = 'pending'
                AND r.property_id = ${propertyId}
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND DATE(e.created_at) = ${date}
                AND COALESCE(e.status, 'pending') = 'pending'
                AND e.property_id = ${propertyId}
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        } else {
          // No date filter - show ALL pending transactions
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND COALESCE(r.status, 'pending') = 'pending'
                AND r.property_id = ${propertyId}
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND COALESCE(e.status, 'pending') = 'pending'
                AND e.property_id = ${propertyId}
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        }
      } else {
        // Use template literals with proper parameter binding
        if (startDate && endDate) {
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND DATE(r.created_at) BETWEEN ${startDate} AND ${endDate}
                AND COALESCE(r.status, 'pending') = 'pending'
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND DATE(e.created_at) BETWEEN ${startDate} AND ${endDate}
                AND COALESCE(e.status, 'pending') = 'pending'
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        } else if (date) {
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND DATE(r.created_at) = ${date}
                AND COALESCE(r.status, 'pending') = 'pending'
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND DATE(e.created_at) = ${date}
                AND COALESCE(e.status, 'pending') = 'pending'
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        } else {
          // No date filter - show ALL pending transactions
          transactions = await financeDB.queryAll`
            WITH pending_transactions AS (
              -- Get pending revenues
              SELECT 
                r.id,
                'revenue' as type,
                r.source,
                NULL as category,
                r.amount_cents,
                r.description,
                p.name as property_name,
                u.display_name as created_by_name,
                r.created_at,
                COALESCE(r.status, 'pending') as status,
                COALESCE(r.payment_mode, 'cash') as payment_mode,
                r.bank_reference,
                r.receipt_url
              FROM revenues r
              JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE r.org_id = ${authData.orgId}
                AND COALESCE(r.status, 'pending') = 'pending'
              
              UNION ALL
              
              -- Get pending expenses
              SELECT 
                e.id,
                'expense' as type,
                NULL as source,
                e.category,
                e.amount_cents,
                e.description,
                p.name as property_name,
                u.display_name as created_by_name,
                e.created_at,
                COALESCE(e.status, 'pending') as status,
                COALESCE(e.payment_mode, 'cash') as payment_mode,
                e.bank_reference,
                e.receipt_url
              FROM expenses e
              JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
              JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
              WHERE e.org_id = ${authData.orgId}
                AND COALESCE(e.status, 'pending') = 'pending'
            )
            SELECT * FROM pending_transactions
            ORDER BY created_at DESC
            LIMIT 100
          `;
        }
      }

      // Format the results
      const allTransactions = transactions.map((t: any) => ({
        id: t.id,
        type: t.type as 'revenue' | 'expense',
        source: t.source,
        category: t.category,
        amountCents: parseInt(t.amount_cents),
        description: t.description,
        propertyName: t.property_name,
        createdByName: t.created_by_name,
        createdAt: t.created_at,
        status: t.status,
        paymentMode: t.payment_mode,
        bankReference: t.bank_reference,
        receiptUrl: t.receipt_url,
      }));

      return {
        success: true,
        transactions: allTransactions,
      };
    } catch (error) {
      console.error('Error getting today\'s pending transactions:', error);
      
      // Handle timeout and connection errors gracefully
      if (error instanceof Error && (
        error.message.includes('timeout') || 
        error.message.includes('connection') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('GenericFailure')
      )) {
        console.log('Database connection timeout, returning empty result to prevent UI blocking');
        return {
          success: true,
          transactions: [],
        };
      }
      
      throw APIError.internal(`Failed to get today's pending transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

// LEGACY: Get today's pending transactions for approval (keep for backward compatibility)
export const getTodayPendingTransactions = api<TodayPendingTransactionsRequest, TodayPendingTransactionsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/today-pending-transactions" },
  getTodayPendingTransactionsHandler
);

// V1: Get today's pending transactions for approval
export const getTodayPendingTransactionsV1 = api<TodayPendingTransactionsRequest, TodayPendingTransactionsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/today-pending-transactions" },
  getTodayPendingTransactionsHandler
);
