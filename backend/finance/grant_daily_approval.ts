import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";

export interface GrantDailyApprovalRequest {
  managerUserId: number;
  approvalDate: string; // YYYY-MM-DD format
  notes?: string;
}

export interface GrantDailyApprovalResponse {
  id: number;
  managerUserId: number;
  approvalDate: string;
  approvedByAdminId: number;
  approvedAt: Date;
  notes?: string;
}

// Grant daily approval for a manager (admin only)
export const grantDailyApproval = api<GrantDailyApprovalRequest, GrantDailyApprovalResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/grant-daily-approval" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { managerUserId, approvalDate, notes } = req;

    try {
      console.log('=== GRANT DAILY APPROVAL DEBUG ===');
      console.log('Manager User ID:', managerUserId);
      console.log('Approval Date:', approvalDate);
      console.log('Notes:', notes);

      // Validate the manager exists and is in the same organization
      const manager = await financeDB.queryRow`
        SELECT id, role, display_name
        FROM users
        WHERE id = ${managerUserId} AND org_id = ${authData.orgId}
      `;

      if (!manager) {
        throw APIError.notFound("Manager not found in your organization");
      }

      if (manager.role !== 'MANAGER') {
        throw APIError.invalidArgument("User is not a manager");
      }

      console.log('Manager found:', manager.display_name);

      // Validate date format (basic check)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(approvalDate)) {
        throw APIError.invalidArgument("Invalid date format. Use YYYY-MM-DD");
      }

      // Check if approval already exists for this manager and date
      const existingApproval = await financeDB.queryRow`
        SELECT id
        FROM daily_approvals
        WHERE org_id = ${authData.orgId} 
          AND manager_user_id = ${managerUserId}
          AND approval_date = ${approvalDate}
      `;

      if (existingApproval) {
        console.log('Approval already exists for this date');
        throw APIError.invalidArgument("Approval already exists for this manager and date");
      }

      // Insert the approval
      const approval = await financeDB.queryRow`
        INSERT INTO daily_approvals (org_id, manager_user_id, approval_date, approved_by_admin_id, notes)
        VALUES (${authData.orgId}, ${managerUserId}, ${approvalDate}, ${parseInt(authData.userID)}, ${notes})
        RETURNING id, manager_user_id, approval_date, approved_by_admin_id, approved_at, notes
      `;

      if (!approval) {
        throw new Error('Failed to create daily approval');
      }

      console.log('Daily approval granted successfully:', approval.id);

      // Create notification for the manager about the approval
      await financeDB.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${managerUserId},
          'daily_approval_granted',
          ${JSON.stringify({
            action: 'daily_approval_granted',
            approval_date: approvalDate,
            approved_by: authData.displayName,
            message: `Daily approval granted for ${approvalDate} by ${authData.displayName}`,
            timestamp: new Date().toISOString(),
            requires_action: false,
            trigger_daily_approval_refresh: true
          })}
        )
      `;

      return {
        id: approval.id,
        managerUserId: approval.manager_user_id,
        approvalDate: approval.approval_date,
        approvedByAdminId: approval.approved_by_admin_id,
        approvedAt: approval.approved_at,
        notes: approval.notes,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error('Grant daily approval error:', error);
      throw new Error('Failed to grant daily approval');
    }
  }
);

export interface ListPendingApprovalsRequest {}

export interface ListPendingApprovalsResponse {
  pendingManagers: Array<{
    managerId: number;
    managerName: string;
    unapprovedTransactionsCount: number;
    lastTransactionDate: string;
    lastApprovalDate?: string;
    needsDailyApproval: boolean; // true if yesterday's transactions need approval
    hasPendingTransactions: boolean; // true if has any pending transactions
    pendingExpenses: number;
    pendingRevenues: number;
  }>;
}

// List managers who need daily approval
// TEMPORARILY DISABLED - causing compilation issues
/*
export const listPendingApprovals = api<{}, ListPendingApprovalsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/pending-approvals" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      console.log('=== DEBUG: Fetching pending approvals ===');
      console.log('Today:', today, 'Yesterday:', yesterday, 'OrgId:', authData.orgId);
      
      // Test simple query first
      console.log('Testing basic user query...');
      const testUsers = await financeDB.rawQueryAll(`SELECT id, display_name FROM users WHERE org_id = $1 AND role = 'MANAGER'`, authData.orgId);
      console.log('Found managers:', testUsers);
      
      console.log('Testing pending revenues query...');
      const testRevenues = await financeDB.rawQueryAll(`SELECT created_by_user_id, COUNT(*) as count FROM revenues WHERE org_id = $1 AND status = 'pending' GROUP BY created_by_user_id`, authData.orgId);
      console.log('Found pending revenues:', testRevenues);
      
      console.log('Testing pending expenses query...');
      const testExpenses = await financeDB.rawQueryAll(`SELECT created_by_user_id, COUNT(*) as count FROM expenses WHERE org_id = $1 AND status = 'pending' GROUP BY created_by_user_id`, authData.orgId);
      console.log('Found pending expenses:', testExpenses);
      
      // Super simple query for now - just get managers with any pending revenues
      console.log('Running simplified pending query...');
      const pendingManagers = await financeDB.rawQueryAll(`
        SELECT 
          u.id as manager_id,
          u.display_name as manager_name,
          0 as yesterday_expenses,
          0 as yesterday_revenues,
          COALESCE(exp.pending_expenses, 0) as pending_expenses,
          COALESCE(rev.pending_revenues, 0) as pending_revenues,
          COALESCE(MAX(r.created_at), '1900-01-01'::timestamp)::date as last_transaction_date,
          NULL as last_approval_date,
          false as has_yesterday_approval,
          false as needs_daily_approval,
          CASE WHEN COALESCE(exp.pending_expenses, 0) + COALESCE(rev.pending_revenues, 0) > 0 THEN true ELSE false END as has_pending_transactions
        FROM users u
        LEFT JOIN (
          SELECT created_by_user_id, COUNT(*) as pending_expenses 
          FROM expenses 
          WHERE org_id = $1 AND status = 'pending' 
          GROUP BY created_by_user_id
        ) exp ON exp.created_by_user_id = u.id
        LEFT JOIN (
          SELECT created_by_user_id, COUNT(*) as pending_revenues 
          FROM revenues 
          WHERE org_id = $1 AND status = 'pending' 
          GROUP BY created_by_user_id
        ) rev ON rev.created_by_user_id = u.id
        LEFT JOIN revenues r ON r.created_by_user_id = u.id AND r.org_id = u.org_id
        WHERE u.org_id = $1 AND u.role = 'MANAGER'
        GROUP BY u.id, u.display_name, exp.pending_expenses, rev.pending_revenues
        HAVING COALESCE(exp.pending_expenses, 0) + COALESCE(rev.pending_revenues, 0) > 0
        ORDER BY (COALESCE(exp.pending_expenses, 0) + COALESCE(rev.pending_revenues, 0)) DESC
      `, authData.orgId);

      console.log('=== DEBUG: Raw query results ===');
      console.log('Found managers:', pendingManagers.length);
      pendingManagers.forEach(manager => {
        console.log(`Manager: ${manager.manager_name}, Pending Expenses: ${manager.pending_expenses}, Pending Revenues: ${manager.pending_revenues}`);
      });

      return {
        pendingManagers: pendingManagers.map(manager => ({
          managerId: manager.manager_id,
          managerName: manager.manager_name,
          unapprovedTransactionsCount: (parseInt(manager.yesterday_expenses) || 0) + (parseInt(manager.yesterday_revenues) || 0),
          lastTransactionDate: manager.last_transaction_date,
          lastApprovalDate: manager.last_approval_date,
          needsDailyApproval: manager.needs_daily_approval,
          hasPendingTransactions: manager.has_pending_transactions,
          pendingExpenses: parseInt(manager.pending_expenses) || 0,
          pendingRevenues: parseInt(manager.pending_revenues) || 0,
        })),
      };
    } catch (error) {
      console.error('=== ERROR: List pending approvals failed ===');
      console.error('Error message:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('OrgId:', authData.orgId);
      console.error('User role:', authData.role);
      
      // Return empty result instead of throwing
      return {
        pendingManagers: []
      };
    }
  }
);
*/

