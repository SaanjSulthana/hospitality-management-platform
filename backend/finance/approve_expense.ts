import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface ApproveExpenseRequest {
  id: number;
  approved: boolean;
  notes?: string;
}

export interface ApproveExpenseResponse {
  success: boolean;
  expenseId: number;
  status: string;
}

// Approves or rejects an expense
export const approveExpense = api<ApproveExpenseRequest, ApproveExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/finance/expenses/:id/approve" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN")(authData); // Only admins can approve expenses

    const { id, approved, notes } = req;

    const tx = await financeDB.begin();
    try {
      // Get expense and check access with org scoping
      const expenseRow = await tx.queryRow`
        SELECT e.id, e.org_id, e.status, e.created_by_user_id, u.display_name as created_by_name
        FROM expenses e
        JOIN users u ON e.created_by_user_id = u.id
        WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
      `;

      if (!expenseRow) {
        throw APIError.notFound("Expense not found");
      }

      if (expenseRow.status !== 'pending') {
        throw APIError.failedPrecondition(`Cannot approve expense with status: ${expenseRow.status}`);
      }

      const newStatus = approved ? 'approved' : 'rejected';

      // Update expense status
      const updateResult = await tx.exec`
        UPDATE expenses 
        SET status = ${newStatus}, approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;

      // Create notification for the expense creator
      await tx.exec`
        INSERT INTO notifications (org_id, user_id, type, payload_json)
        VALUES (
          ${authData.orgId},
          ${expenseRow.created_by_user_id},
          ${'expense_' + newStatus},
          ${JSON.stringify({
            expense_id: id,
            status: newStatus,
            approved_by: authData.displayName,
            notes: notes || null,
            message: `Your expense has been ${newStatus}${notes ? ': ' + notes : ''}`
          })}
        )
      `;

      await tx.commit();

      return {
        success: true,
        expenseId: id,
        status: newStatus,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve expense error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to approve expense");
    }
  }
);
