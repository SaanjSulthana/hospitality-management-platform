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

// Shared handler for getting pending approvals (used by both legacy and v1 endpoints)
async function getPendingApprovalsHandler(): Promise<PendingApprovalsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

    // Check if status columns exist in both tables
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Only consider status columns present if they exist in BOTH tables
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    const tx = await financeDB.begin();
    try {
      // Get pending expenses
      let pendingExpenses: any[] = [];
      if (hasStatusColumns) {
        pendingExpenses = await tx.queryAll`
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
      } else {
        // Fallback: get all expenses (assuming they're all pending if no status column)
        pendingExpenses = await tx.queryAll`
          SELECT 
            e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
            e.description, e.created_by_user_id, e.created_at,
            u.display_name as created_by_name
          FROM expenses e
          JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
          JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
          WHERE e.org_id = ${authData.orgId}
          ORDER BY e.created_at ASC
        `;
      }

      // Get pending revenues
      let pendingRevenues: any[] = [];
      if (hasStatusColumns) {
        pendingRevenues = await tx.queryAll`
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
      } else {
        // Fallback: get all revenues (assuming they're all pending if no status column)
        pendingRevenues = await tx.queryAll`
          SELECT 
            r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency,
            r.description, r.created_by_user_id, r.created_at,
            u.display_name as created_by_name
          FROM revenues r
          JOIN properties p ON r.property_id = p.id AND p.org_id = ${authData.orgId}
          JOIN users u ON r.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
          WHERE r.org_id = ${authData.orgId}
          ORDER BY r.created_at ASC
        `;
      }

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
        status: expense.status || 'pending'
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
        status: revenue.status || 'pending'
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

// LEGACY: Get pending approvals for admin review (keep for backward compatibility)
export const getPendingApprovals = api<{}, PendingApprovalsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/pending-approvals" },
  getPendingApprovalsHandler
);

// V1: Get pending approvals for admin review
export const getPendingApprovalsV1 = api<{}, PendingApprovalsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/pending-approvals" },
  getPendingApprovalsHandler
);

