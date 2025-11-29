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

// Shared handler for resetting approval status (used by both legacy and v1 endpoints)
async function resetApprovalStatusHandler(req: {}): Promise<ResetApprovalStatusResponse> {
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

// LEGACY: Reset all approved transactions to pending status (keep for backward compatibility)
export const resetApprovalStatus = api<{}, ResetApprovalStatusResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/reset-approval-status" },
  resetApprovalStatusHandler
);

// V1: Reset all approved transactions to pending status
export const resetApprovalStatusV1 = api<{}, ResetApprovalStatusResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/reset-approval-status" },
  resetApprovalStatusHandler
);

