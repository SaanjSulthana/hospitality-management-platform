import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface AddExpenseRequest {
  propertyId: number;
  category: string;
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  expenseDate: Date;
}

export interface AddExpenseResponse {
  id: number;
  propertyId: number;
  category: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  expenseDate: Date;
  status: string;
  createdByUserId: number;
  createdAt: Date;
}

// Adds a new expense record
export const addExpense = api<AddExpenseRequest, AddExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expenses" },
  async (req) => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, category, amountCents, currency = "USD", description, receiptUrl, expenseDate } = req;

    // Check property access
    const propertyRow = await financeDB.queryRow`
      SELECT p.id, p.org_id
      FROM properties p
      WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
    `;

    if (!propertyRow) {
      throw APIError.notFound("Property not found");
    }

    if (authData.role === "MANAGER") {
      const accessCheck = await financeDB.queryRow`
        SELECT 1 FROM user_properties WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
      `;
      if (!accessCheck) {
        throw APIError.permissionDenied("No access to this property");
      }
    }

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    // Create expense record
    const expenseRow = await financeDB.queryRow`
      INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, status)
      VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${expenseDate}, ${parseInt(authData.userID)}, 'pending')
      RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, status, created_by_user_id, created_at
    `;

    // Auto-approve for admins, require approval for managers
    if (authData.role === "ADMIN") {
      await financeDB.exec`
        UPDATE expenses 
        SET status = 'approved', approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
        WHERE id = ${expenseRow.id}
      `;
      expenseRow.status = 'approved';
    }

    return {
      id: expenseRow.id,
      propertyId: expenseRow.property_id,
      category: expenseRow.category,
      amountCents: expenseRow.amount_cents,
      currency: expenseRow.currency,
      description: expenseRow.description,
      receiptUrl: expenseRow.receipt_url,
      expenseDate: expenseRow.expense_date,
      status: expenseRow.status,
      createdByUserId: expenseRow.created_by_user_id,
      createdAt: expenseRow.created_at,
    };
  }
);
