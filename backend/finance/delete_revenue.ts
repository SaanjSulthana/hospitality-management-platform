import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { checkDailyApproval } from "./check_daily_approval";

export interface DeleteRevenueRequest {
  id: number;
}

export interface DeleteRevenueResponse {
  id: number;
  deleted: boolean;
}

// Deletes a revenue record
export const deleteRevenue = api<DeleteRevenueRequest, DeleteRevenueResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/finance/revenues/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id } = req;

    // Check if manager can delete transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApproval({});
      if (!approvalCheck.canAddTransactions) {
        throw APIError.permissionDenied(
          approvalCheck.message || "You cannot delete transactions at this time. Please wait for admin approval."
        );
      }
    }

    const tx = await financeDB.begin();
    try {
      // Get existing revenue and check access with org scoping
      const revenueRow = await tx.queryRow`
        SELECT r.id, r.org_id, r.status, r.created_by_user_id, r.property_id, r.amount_cents, r.source
        FROM revenues r
        WHERE r.id = ${id} AND r.org_id = ${authData.orgId}
      `;

      if (!revenueRow) {
        throw APIError.notFound("Revenue not found");
      }

      // Check if user can delete this revenue
      if (authData.role === "MANAGER") {
        // Managers can only delete their own revenues or revenues for properties they manage
        const canDelete = await tx.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties up 
            WHERE up.user_id = ${parseInt(authData.userID)} 
            AND up.property_id = ${revenueRow.property_id}
          ) OR r.created_by_user_id = ${parseInt(authData.userID)}
          FROM revenues r
          WHERE r.id = ${id}
        `;
        
        if (!canDelete) {
          throw APIError.permissionDenied("You can only delete revenues for properties you manage or revenues you created");
        }
      }

      // For managers, create a deletion request instead of actually deleting
      if (authData.role === "MANAGER") {
        // Create a deletion request record
        await tx.exec`
          INSERT INTO revenue_deletion_requests (
            org_id, revenue_id, requested_by_user_id, amount_cents, source, 
            reason, status, created_at
          ) VALUES (
            ${authData.orgId}, ${id}, ${parseInt(authData.userID)}, 
            ${revenueRow.amount_cents}, ${revenueRow.source}, 
            'Revenue deletion requested by manager', 'pending', NOW()
          )
        `;

        // Create notification for admins
        await tx.exec`
          INSERT INTO notifications (org_id, user_id, type, title, message, data, created_at)
          SELECT 
            ${authData.orgId},
            u.id,
            'revenue_deletion_request',
            'Revenue Deletion Request',
            'A manager has requested to delete a revenue that requires approval',
            json_build_object('revenue_id', ${id}, 'requested_by', ${authData.userID}, 'amount', ${revenueRow.amount_cents}),
            NOW()
          FROM users u
          WHERE u.org_id = ${authData.orgId} AND u.role IN ('ADMIN')
        `;

        await tx.commit();

        return {
          id,
          deleted: false, // Not actually deleted, just requested
        };
      } else {
        // Admins can delete directly
        await tx.exec`
          DELETE FROM revenues 
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;

        await tx.commit();

        return {
          id,
          deleted: true,
        };
      }
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);
