import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface TestAddExpenseRequest {
  propertyId: number;
  category: string;
  amountCents: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate: string;
  paymentMode?: 'cash' | 'bank';
  bankReference?: string;
}

export interface TestAddExpenseResponse {
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
  success: boolean;
  error?: string;
}

// Test version of add expense without daily approval check
export const testAddExpense = api<TestAddExpenseRequest, TestAddExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/test-add-expense" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, category, amountCents, currency = "USD", description, receiptUrl, receiptFileId, expenseDate, paymentMode = "cash", bankReference } = req;
    
    // Use provided expense date for expense_date field, but current timestamp for created_at
    const expenseDateValue = expenseDate ? new Date(expenseDate) : new Date();
    const currentTimestamp = new Date();
    console.log('Test expense creation - expense_date:', expenseDateValue.toISOString());
    console.log('Test expense creation - current timestamp:', currentTimestamp.toISOString());

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    const tx = await financeDB.begin();
    try {
      // First check if the expenses table exists
      const expensesTableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expenses'
        )
      `;
      
      if (!expensesTableExists?.exists) {
        throw APIError.internal("Database not initialized. Please run database setup first.");
      }

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

      // Create expense record - handle potential missing columns gracefully
      let expenseRow;
      try {
        expenseRow = await tx.queryRow`
          INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, receipt_file_id, expense_date, created_by_user_id, status, payment_mode, bank_reference, created_at)
          VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${receiptFileId || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${currentTimestamp})
          RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, receipt_file_id, expense_date, status, created_by_user_id, created_at, payment_mode, bank_reference
        `;
      } catch (dbError: any) {
        console.error('Database error during test expense creation:', dbError);
        
        // If columns are missing, try without the new columns
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          expenseRow = await tx.queryRow`
            INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, created_at)
            VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, ${currentTimestamp})
            RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, created_at
          `;
          
          // Set default values for missing columns
          if (expenseRow) {
            expenseRow.status = 'pending';
            expenseRow.payment_mode = paymentMode;
            expenseRow.bank_reference = bankReference;
            expenseRow.receipt_file_id = receiptFileId;
          }
        } else {
          throw dbError;
        }
      }

      if (!expenseRow) {
        throw new Error("Failed to create expense record");
      }

      // Auto-approve for admins, require approval for managers
      if (authData.role === "ADMIN") {
        try {
          await tx.exec`
            UPDATE expenses 
            SET status = 'approved', approved_by_user_id = ${parseInt(authData.userID)}, approved_at = NOW()
            WHERE id = ${expenseRow.id} AND org_id = ${authData.orgId}
          `;
          expenseRow.status = 'approved';
        } catch (updateError: any) {
          console.warn('Could not update expense status:', updateError.message);
          // Continue without status update if columns don't exist
        }
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
        success: true,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Test add expense error:', error);
      
      return {
        id: 0,
        propertyId: 0,
        category: '',
        amountCents: 0,
        currency: '',
        expenseDate: new Date(),
        paymentMode: '',
        createdByUserId: 0,
        createdAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

