import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface ResetApprovalStatusResponse {
  success: boolean;
  message: string;
  results: {
    revenuesReset: number;
    expensesReset: number;
  };
}

// Reset all approved transactions to pending status (for testing purposes)
export const resetApprovalStatus = api<{}, ResetApprovalStatusResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/reset-approval-status" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      // Reset all approved revenues to pending
      const revenueResult = await financeDB.exec`
        UPDATE revenues 
        SET status = 'pending', approved_by_user_id = NULL, approved_at = NULL
        WHERE org_id = ${authData.orgId} AND status = 'approved'
      `;

      // Reset all approved expenses to pending
      const expenseResult = await financeDB.exec`
        UPDATE expenses 
        SET status = 'pending', approved_by_user_id = NULL, approved_at = NULL
        WHERE org_id = ${authData.orgId} AND status = 'approved'
      `;

      return {
        success: true,
        message: "All approved transactions have been reset to pending status",
        results: {
          revenuesReset: (revenueResult as any)?.rowCount || 0,
          expensesReset: (expenseResult as any)?.rowCount || 0,
        },
      };
    } catch (error) {
      console.error('Error resetting approval status:', error);
      throw APIError.internal(`Failed to reset approval status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

