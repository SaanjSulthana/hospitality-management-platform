import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface ApproveRevenueRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveRevenueResponse {
  success: boolean;
  revenueId: number;
  status: string;
}

// Approves or rejects a revenue
export const approveRevenue = api<ApproveRevenueRequest, ApproveRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues/approve" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData); // Only admins can approve revenues

    const { id, approved, notes } = req;

    const tx = await financeDB.begin();
    try {
      // Get revenue and check access with org scoping
      const revenueRow = await tx.queryRow`
        SELECT r.id, r.org_id, r.status, r.created_by_user_id, u.display_name as created_by_name
        FROM revenues r
        JOIN users u ON r.created_by_user_id = u.id
        WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
      `;

      if (!revenueRow) {
        throw APIError.notFound("Revenue not found");
      }

      if (revenueRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve revenue with status: ${revenueRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update revenue status
      const updateResult = await tx.exec`
        UPDATE revenues 
        SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      // Create notification for the revenue creator
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${revenueRow.created_by_user_id},
          ${'revenue_' + newStatus},
          ${JSON.stringify({
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            notes: notes || null,
            message: `Your revenue has been ${newStatus}${notes ? ': ' + notes : ''}`,
            timestamp: new Date().toISOString(),
            requires_action: false
          })}
        )
      `;

      // Create notification for all managers in the organization to trigger real-time updates
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        SELECT 
          ${authData.orgId},
          u.id,
          'finance_update',
          ${JSON.stringify({
            action: 'revenue_approved',
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Revenue ${id} has been ${newStatus}`,
            timestamp: new Date().toISOString(),
            requires_action: false
          })}
        FROM users u
        WHERE u.org_id = ${authData.orgId} 
          AND u.role = 'MANAGER'
          AND u.id != ${parseInt(authData.userID)}
      `;

      // Create notification for daily approval status update
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        SELECT 
          ${authData.orgId},
          u.id,
          'daily_approval_update',
          ${JSON.stringify({
            action: 'revenue_approved',
            revenue_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            message: `Daily approval status updated - revenue ${id} ${newStatus}`,
            timestamp: new Date().toISOString(),
            requires_action: false,
            trigger_daily_approval_refresh: true
          })}
        FROM users u
        WHERE u.org_id = ${authData.orgId} 
          AND u.role = 'MANAGER'
      `;

      // Auto-grant daily approval for the manager if this is an approval
      if (newStatus === 'approved') {
        const revenue = await tx.queryRow`
          SELECT created_by_user_id, created_at
          FROM revenues
          WHERE id = ${id}
        `;
        
        if (revenue) {
          const revenueDate = new Date(revenue.created_at).toISOString().split('T')[0];
          
          // Check if daily approval already exists
          const existingApproval = await tx.queryRow`
            SELECT id
            FROM daily_approvals
            WHERE org_id = ${authData.orgId} 
              AND manager_user_id = ${revenue.created_by_user_id}
              AND approval_date = ${revenueDate}
          `;
          
          if (!existingApproval) {
            // Grant daily approval for the manager
            await tx.exec`
              INSERT INTO daily_approvals (org_id, manager_user_id, approval_date, approved_by_admin_id, notes)
              VALUES (
                ${authData.orgId}, 
                ${revenue.created_by_user_id}, 
                ${revenueDate}, 
                ${parseInt(authData.userID)}, 
                'Auto-granted when revenue was approved'
              )
            `;
            
            console.log(`Auto-granted daily approval for manager ${revenue.created_by_user_id} on ${revenueDate}`);
          }
        }
      }

      await tx.commit();

      return {
        success: true,
        revenueId: id,
        status: newStatus,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve revenue error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to approve revenue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

