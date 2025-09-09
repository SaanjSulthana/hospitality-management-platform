import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CheckDailyApprovalResponse {
  canAddTransactions: boolean;
  requiresApproval: boolean;
  hasApprovalForToday: boolean;
  hasUnapprovedTransactions: boolean;
  lastApprovalDate?: string;
  message?: string;
}

export interface DebugTransactionStatusResponse {
  userId: number;
  orgId: number;
  role: string;
  totalTransactions: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  transactions: any[];
  debugInfo: {
    canAddTransactions: boolean;
    hasUnapprovedTransactions: boolean;
    message: string;
  };
  error?: string;
}

// Check if a manager can add new transactions based on daily approval workflow
export const checkDailyApproval = api<{}, CheckDailyApprovalResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/check-daily-approval" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Admins can always add transactions
    if (authData.role === "ADMIN") {
      return {
        canAddTransactions: true,
        requiresApproval: false,
        hasApprovalForToday: false,
        hasUnapprovedTransactions: false,
        message: "Admins can always add transactions.",
      };
    }

    // For managers, check the approval workflow
    if (authData.role === "MANAGER") {
      const userId = parseInt(authData.userID);

      try {
        console.log('=== DAILY APPROVAL CHECK DEBUG ===');
        console.log('User ID:', authData.userID, 'Org ID:', authData.orgId);

        // New logic: Check if manager has daily approval for today
        const today = new Date().toISOString().split('T')[0];
        
        // Check if manager has daily approval for today
        const dailyApproval = await financeDB.queryRow`
          SELECT id, approval_date, approved_by_admin_id, notes
          FROM daily_approvals
          WHERE org_id = ${authData.orgId}
            AND manager_user_id = ${userId}
            AND approval_date = ${today}
        `;

        console.log('Today:', today);
        console.log('Daily approval for today:', dailyApproval);

        // If manager has daily approval for today, they can add transactions
        if (dailyApproval) {
          console.log('Manager has daily approval for today - can add transactions');
          return {
            canAddTransactions: true,
            requiresApproval: true,
            hasApprovalForToday: true,
            hasUnapprovedTransactions: false,
            message: "You have daily approval for today. You can add transactions.",
          };
        }

        // Check if there are any pending transactions from previous days
        const pendingFromPreviousDays = await financeDB.queryRow`
          SELECT 
            COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as pending_expenses,
            COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END) as pending_revenues
          FROM (SELECT 1) dummy
          LEFT JOIN expenses e ON e.created_by_user_id = ${userId}
            AND e.org_id = ${authData.orgId}
            AND e.status = 'pending'
            AND DATE(e.created_at) < ${today}
          LEFT JOIN revenues r ON r.created_by_user_id = ${userId}
            AND r.org_id = ${authData.orgId}
            AND r.status = 'pending'
            AND DATE(r.created_at) < ${today}
        `;

        const totalPendingFromPreviousDays = 
          parseInt(pendingFromPreviousDays?.pending_expenses || 0) + 
          parseInt(pendingFromPreviousDays?.pending_revenues || 0);

        console.log('Pending transactions from previous days:', totalPendingFromPreviousDays);

        // If there are pending transactions from previous days, manager needs daily approval
        if (totalPendingFromPreviousDays > 0) {
          console.log('Has pending transactions from previous days - needs daily approval');
          return {
            canAddTransactions: false,
            requiresApproval: true,
            hasApprovalForToday: false,
            hasUnapprovedTransactions: true,
            message: `You have ${totalPendingFromPreviousDays} unapproved transactions from previous days. Please wait for admin approval.`,
          };
        }

        // If no pending transactions from previous days, manager can add transactions for today
        console.log('No pending transactions from previous days - can add transactions for today');
        return {
          canAddTransactions: true,
          requiresApproval: true,
          hasApprovalForToday: false,
          hasUnapprovedTransactions: false,
          message: "You can add transactions for today.",
        };


      } catch (error) {
        console.error('Check daily approval error:', error);
        
        // On error, allow transactions and show clearer message
        return {
          canAddTransactions: true,
          requiresApproval: true,
          hasApprovalForToday: false,
          hasUnapprovedTransactions: false,
          message: "You can add transactions. (Approval system temporarily unavailable)",
        };
      }
    }

    // For any other role (shouldn't happen with current setup)
    return {
      canAddTransactions: false,
      requiresApproval: true,
      hasApprovalForToday: false,
      hasUnapprovedTransactions: false,
      message: "Insufficient permissions to add transactions.",
    };
  }
);

// Debug endpoint to check transaction status for a manager
export const debugTransactionStatus = api<{}, DebugTransactionStatusResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/debug-transaction-status" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const userId = parseInt(authData.userID);

    try {
      // Get all transactions for the user with their status
      const allTransactions = await financeDB.queryAll`
        SELECT 
          'expense' as type,
          id,
          status,
          amount_cents,
          created_at,
          updated_at
        FROM expenses 
        WHERE created_by_user_id = ${userId} AND org_id = ${authData.orgId}
        UNION ALL
        SELECT 
          'revenue' as type,
          id,
          status,
          amount_cents,
          created_at,
          updated_at
        FROM revenues 
        WHERE created_by_user_id = ${userId} AND org_id = ${authData.orgId}
        ORDER BY created_at DESC
      `;

      // Get pending transactions count
      const pendingCount = allTransactions.filter(t => t.status === 'pending').length;
      const approvedCount = allTransactions.filter(t => t.status === 'approved').length;
      const rejectedCount = allTransactions.filter(t => t.status === 'rejected').length;

      return {
        userId,
        orgId: authData.orgId,
        role: authData.role,
        totalTransactions: allTransactions.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        transactions: allTransactions,
        debugInfo: {
          canAddTransactions: pendingCount === 0,
          hasUnapprovedTransactions: pendingCount > 0,
          message: pendingCount > 0 
            ? `You have ${pendingCount} pending transactions` 
            : "You can add transactions"
        }
      };
    } catch (error) {
      console.error('Debug transaction status error:', error);
      return {
        userId,
        orgId: authData.orgId,
        role: authData.role,
        totalTransactions: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        transactions: [],
        debugInfo: {
          canAddTransactions: false,
          hasUnapprovedTransactions: false,
          message: "Error occurred while checking transactions"
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

