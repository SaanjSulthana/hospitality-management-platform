import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { checkDailyApproval } from "./check_daily_approval";

export interface DeleteExpenseRequest {
  id: number;
}

export interface DeleteExpenseResponse {
  id: number;
  deleted: boolean;
}

// Deletes an expense record
export const deleteExpense = api<DeleteExpenseRequest, DeleteExpenseResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/finance/expenses/:id" },
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
      // Get existing expense and check access with org scoping
      const expenseRow = await tx.queryRow`
        SELECT e.id, e.org_id, e.status, e.created_by_user_id, e.property_id, e.amount_cents, e.category
        FROM expenses e
        WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
      `;

      if (!expenseRow) {
        throw APIError.notFound("Expense not found");
      }

      // Check if user can delete this expense
      if (authData.role === "MANAGER") {
        // Managers can only delete their own expenses or expenses for properties they manage
        const canDelete = await tx.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties up 
            WHERE up.user_id = ${parseInt(authData.userID)} 
            AND up.property_id = ${expenseRow.property_id}
          ) OR e.created_by_user_id = ${parseInt(authData.userID)}
          FROM expenses e
          WHERE e.id = ${id}
        `;
        
        if (!canDelete) {
          throw APIError.permissionDenied("You can only delete expenses for properties you manage or expenses you created");
        }
      }

      // For managers, create a deletion request instead of actually deleting
      if (authData.role === "MANAGER") {
        // Create a deletion request record
        await tx.exec`
          INSERT INTO expense_deletion_requests (
            org_id, expense_id, requested_by_user_id, amount_cents, category, 
            reason, status, created_at
          ) VALUES (
            ${authData.orgId}, ${id}, ${parseInt(authData.userID)}, 
            ${expenseRow.amount_cents}, ${expenseRow.category}, 
            'Expense deletion requested by manager', 'pending', NOW()
          )
        `;

        // Create notification for admins
        await tx.exec`
          INSERT INTO notifications (org_id, user_id, type, title, message, data, created_at)
          SELECT 
            ${authData.orgId},
            u.id,
            'expense_deletion_request',
            'Expense Deletion Request',
            'A manager has requested to delete an expense that requires approval',
            json_build_object('expense_id', ${id}, 'requested_by', ${authData.userID}, 'amount', ${expenseRow.amount_cents}),
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
        // Get receipt file ID before deleting
        const receiptFileId = expenseRow.receipt_file_id;

        // Delete expense record
        await tx.exec`
          DELETE FROM expenses 
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;

        await tx.commit();

        // Clean up receipt file if it exists and is not referenced by other transactions
        if (receiptFileId) {
          try {
            // Check if file is referenced by other transactions
            const revenueRefs = await tx.queryRow`
              SELECT COUNT(*) as count FROM revenues WHERE receipt_file_id = ${receiptFileId} AND org_id = ${authData.orgId}
            `;
            
            const otherExpenseRefs = await tx.queryRow`
              SELECT COUNT(*) as count FROM expenses WHERE receipt_file_id = ${receiptFileId} AND org_id = ${authData.orgId}
            `;

            const totalRefs = (revenueRefs?.count || 0) + (otherExpenseRefs?.count || 0);

            // If file is not referenced by any other transactions, delete it
            if (totalRefs === 0) {
              // Note: We don't delete the file here as it requires uploads service
              // The cleanup can be done via the cleanup endpoint or background job
              console.log(`Receipt file ${receiptFileId} is orphaned and can be cleaned up`);
            }
          } catch (error) {
            console.error('Error checking receipt file references:', error);
            // Don't fail the expense deletion if file cleanup fails
          }
        }

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
