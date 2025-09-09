import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface DebugDailyApprovalResponse {
  userId: number;
  orgId: number;
  today: string;
  dayAfterTomorrow: string;
  cutoffDate: string;
  pendingTransactions: {
    expenses: number;
    revenues: number;
    total: number;
  };
  allPendingTransactions: any[];
  canAddTransactions: boolean;
  message: string;
}

// Debug endpoint to check daily approval logic
export const debugDailyApproval = api<{}, DebugDailyApprovalResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/debug-daily-approval" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const userId = parseInt(authData.userID);
    
    // Calculate dates
    const today = new Date();
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);
    const cutoffDate = dayAfterTomorrow.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Get all pending transactions for debugging
    const allPendingTransactions = await financeDB.queryAll`
      SELECT 
        'expense' as type,
        id,
        status,
        created_at,
        DATE(created_at) as created_date
      FROM expenses 
      WHERE created_by_user_id = ${userId} 
        AND org_id = ${authData.orgId}
        AND status = 'pending'
      UNION ALL
      SELECT 
        'revenue' as type,
        id,
        status,
        created_at,
        DATE(created_at) as created_date
      FROM revenues 
      WHERE created_by_user_id = ${userId} 
        AND org_id = ${authData.orgId}
        AND status = 'pending'
      ORDER BY created_at DESC
    `;

    // Get pending transactions older than cutoff date
    const pendingTransactions = await financeDB.queryRow`
      SELECT 
        COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as pending_expenses,
        COUNT(CASE WHEN r.id IS NOT NULL THEN 1 END) as pending_revenues
      FROM (SELECT 1) dummy
      LEFT JOIN expenses e ON e.created_by_user_id = ${userId}
        AND e.org_id = ${authData.orgId}
        AND e.status = 'pending'
        AND DATE(e.created_at) < ${cutoffDate}
      LEFT JOIN revenues r ON r.created_by_user_id = ${userId}
        AND r.org_id = ${authData.orgId}
        AND r.status = 'pending'
        AND DATE(r.created_at) < ${cutoffDate}
    `;

    const totalPendingTransactions = 
      parseInt(pendingTransactions?.pending_expenses || 0) + 
      parseInt(pendingTransactions?.pending_revenues || 0);

    const canAddTransactions = totalPendingTransactions === 0;
    const message = canAddTransactions 
      ? "You can add transactions." 
      : `You have ${totalPendingTransactions} unapproved transactions older than 2 days. Please wait for admin approval.`;

    return {
      userId,
      orgId: authData.orgId,
      today: todayStr,
      dayAfterTomorrow: dayAfterTomorrow.toISOString().split('T')[0],
      cutoffDate,
      pendingTransactions: {
        expenses: parseInt(pendingTransactions?.pending_expenses || 0),
        revenues: parseInt(pendingTransactions?.pending_revenues || 0),
        total: totalPendingTransactions
      },
      allPendingTransactions,
      canAddTransactions,
      message
    };
  }
);
