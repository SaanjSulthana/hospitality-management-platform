import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface PendingApproval {
  id: number;
  type: 'expense' | 'revenue';
  propertyId: number;
  propertyName: string;
  amountCents: number;
  currency: string;
  description?: string;
  category?: string;
  source?: string;
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
  status: string;
}

export interface PendingApprovalsResponse {
  expenses: PendingApproval[];
  revenues: PendingApproval[];
  totalCount: number;
}

// Get pending approvals for admin review
export const getPendingApprovals = api<{}, PendingApprovalsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/pending-approvals" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await financeDB.begin();
    try {
      // Get pending expenses
      const pendingExpenses = await tx.queryAll`
        SELECT 
          e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
          e.description, e.created_by_user_id, e.created_at, e.status,
          u.display_name as created_by_name
        FROM expenses e
        JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        WHERE e.org_id = ${authData.orgId} AND e.status = 'pending'
        ORDER BY e.created_at ASC
      `;

      // Get pending revenues
      const pendingRevenues = await tx.queryAll`
        SELECT 
          r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
          r.description, r.created_by_user_id, r.created_at, r.status,
          u.display_name as created_by_name
        FROM revenues r
        JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        WHERE r.org_id = ${authData.orgId} AND r.status = 'pending'
        ORDER BY r.created_at ASC
      `;

      // Format expenses
      const expenses: PendingApproval[] = pendingExpenses.map((expense: any) => ({
        id: expense.id,
        type: 'expense' as const,
        propertyId: expense.property_id,
        propertyName: expense.property_name,
        amountCents: expense.amount_cents,
        currency: expense.currency,
        description: expense.description,
        category: expense.category,
        createdByUserId: expense.created_by_user_id,
        createdByName: expense.created_by_name,
        createdAt: expense.created_at,
        status: expense.status
      }));

      // Format revenues
      const revenues: PendingApproval[] = pendingRevenues.map((revenue: any) => ({
        id: revenue.id,
        type: 'revenue' as const,
        propertyId: revenue.property_id,
        propertyName: revenue.property_name,
        amountCents: revenue.amount_cents,
        currency: revenue.currency,
        description: revenue.description,
        source: revenue.source,
        createdByUserId: revenue.created_by_user_id,
        createdByName: revenue.created_by_name,
        createdAt: revenue.created_at,
        status: revenue.status
      }));

      await tx.commit();

      return {
        expenses,
        revenues,
        totalCount: expenses.length + revenues.length
      };
    } catch (error) {
      await tx.rollback();
      console.error('Get pending approvals error:', error);
      throw APIError.internal("Failed to get pending approvals");
    }
  }
);

