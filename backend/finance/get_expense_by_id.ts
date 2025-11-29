import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { v1Path } from "../shared/http";

export interface GetExpenseByIdRequest {
  id: number;
}

export interface GetExpenseByIdResponse {
  id: number;
  propertyId: number;
  propertyName: string;
  category: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate: Date;
  paymentMode: 'cash' | 'bank';
  bankReference?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdByUserId: number;
  createdByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

// Gets a single expense by ID (for realtime reconciliation)
async function getExpenseByIdHandler(req: GetExpenseByIdRequest): Promise<GetExpenseByIdResponse> {
    const { id } = req;
    const authData = getAuthData();
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const expense = await financeDB.queryRow`
        SELECT
          e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
          e.description, e.receipt_url, e.receipt_file_id, e.expense_date,
          e.payment_mode, e.bank_reference,
          COALESCE(e.status, 'pending') as status, e.created_by_user_id,
          u.display_name as created_by_name,
          e.approved_by_user_id, au.display_name as approved_by_name, e.approved_at, e.created_at
        FROM expenses e
        JOIN properties p ON e.property_id = p.id AND p.org_id = ${authData.orgId}
        JOIN users u ON e.created_by_user_id = u.id AND u.org_id = ${authData.orgId}
        LEFT JOIN users au ON e.approved_by_user_id = au.id AND au.org_id = ${authData.orgId}
        WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
      `;

      if (!expense) {
        throw APIError.notFound("Expense not found");
      }

      // Check manager property access
      if (authData.role === "MANAGER") {
        const hasAccess = await financeDB.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties
            WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${expense.property_id}
          ) as has_access
        `;
        
        if (!hasAccess?.has_access) {
          throw APIError.permissionDenied("You don't have access to this property");
        }
      }

      return {
        id: expense.id,
        propertyId: expense.property_id,
        propertyName: expense.property_name,
        category: expense.category,
        amountCents: expense.amount_cents,
        currency: expense.currency,
        description: expense.description,
        receiptUrl: expense.receipt_url,
        receiptFileId: expense.receipt_file_id,
        expenseDate: expense.expense_date,
        paymentMode: expense.payment_mode,
        bankReference: expense.bank_reference,
        status: expense.status,
        createdByUserId: expense.created_by_user_id,
        createdByName: expense.created_by_name,
        approvedByUserId: expense.approved_by_user_id,
        approvedByName: expense.approved_by_name,
        approvedAt: expense.approved_at,
        createdAt: expense.created_at,
      };
    } catch (error) {
      console.error('Get expense by ID error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal(`Failed to fetch expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export const getExpenseById = api<GetExpenseByIdRequest, GetExpenseByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/expenses/:id" },
  getExpenseByIdHandler
);

export const getExpenseByIdV1 = api<GetExpenseByIdRequest, GetExpenseByIdResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/expenses/:id" },
  getExpenseByIdHandler
);

