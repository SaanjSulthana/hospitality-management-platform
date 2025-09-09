import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApproval } from "./check_daily_approval";

export interface AddExpenseRequest {
  propertyId: number;
  category: string;
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate: string; // Changed from Date to string for consistency
  paymentMode?: 'cash' | 'bank';
  bankReference?: string;
}

export interface AddExpenseResponse {
  id: number;
  propertyId: number;
  category: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate: Date;
  paymentMode: string;
  bankReference?: string;
  createdByUserId: number;
  createdAt: Date;
}

// Adds a new expense record
export const addExpense = api<AddExpenseRequest, AddExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expenses" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check if manager can add transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApproval({});
      if (!approvalCheck.canAddTransactions) {
        throw APIError.permissionDenied(
          approvalCheck.message || "You cannot add transactions at this time. Please wait for admin approval."
        );
      }
    }

    const { propertyId, category, amountCents, currency = "USD", description, receiptUrl, receiptFileId, expenseDate, paymentMode = "cash", bankReference } = req;
    
    // Use provided expense date for expense_date field, but current timestamp for created_at
    const expenseDateValue = expenseDate ? new Date(expenseDate) : new Date();
    const currentTimestamp = new Date();
    console.log('Expense creation - expense_date:', expenseDateValue.toISOString());
    console.log('Expense creation - current timestamp:', currentTimestamp.toISOString());

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    const tx = await financeDB.begin();
    try {
      // Check property access with org scoping
      const propertyRow = await tx.queryRow`
        SELECT p.id, p.org_id
        FROM properties p
        WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
      `;

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM user_properties 
          WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
        `;
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Create expense record
      const expenseRow = await tx.queryRow`
        INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, receipt_file_id, expense_date, created_by_user_id, status, payment_mode, bank_reference, created_at)
        VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${receiptFileId || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${currentTimestamp})
        RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, receipt_file_id, expense_date, status, created_by_user_id, created_at, payment_mode, bank_reference
      `;

      if (!expenseRow) {
        throw new Error("Failed to create expense record");
      }

      // Auto-approve for admins, require approval for managers
      if (authData.role === "ADMIN") {
        await tx.exec`
          UPDATE expenses 
          SET status = 'approved', approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
          WHERE id = ${expenseRow.id} AND org_id = ${authData.orgId}
        `;
        expenseRow.status = 'approved';
      }

      await tx.commit();

      return {
        id: expenseRow.id,
        propertyId: expenseRow.property_id,
        category: expenseRow.category,
        amountCents: expenseRow.amount_cents,
        currency: expenseRow.currency,
        description: expenseRow.description,
        receiptUrl: expenseRow.receipt_url,
        receiptFileId: expenseRow.receipt_file_id,
        expenseDate: expenseRow.expense_date,
        paymentMode: expenseRow.payment_mode,
        bankReference: expenseRow.bank_reference,
        createdByUserId: expenseRow.created_by_user_id,
        createdAt: expenseRow.created_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Add expense error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to add expense");
    }
  }
);

