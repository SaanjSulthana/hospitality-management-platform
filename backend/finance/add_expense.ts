import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApprovalInternal } from "./check_daily_approval";

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
    console.log('=== ADD EXPENSE FUNCTION CALLED ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check if manager can add transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      const approvalCheck = await checkDailyApprovalInternal(authData);
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

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    try {
      console.log('Starting expense insertion process');
      // First check if the expenses table exists
      const expensesTableExists = await financeDB.queryRow`
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
        expenseRow = await financeDB.queryRow`
          INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at)
          VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, 'pending', ${paymentMode}, ${bankReference || null}, ${receiptFileId || null}, ${currentTimestamp})
          RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, status, created_by_user_id, created_at, payment_mode, bank_reference, receipt_file_id
        `;
      } catch (dbError: any) {
        console.error('Database error during expense creation:', dbError);
        
        // If columns are missing, try without the new columns
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          expenseRow = await financeDB.queryRow`
            INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, status, created_at)
            VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${receiptUrl || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, 'pending', ${currentTimestamp})
            RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, status, created_at
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

      // All transactions now require daily approval - no auto-approval
      // Status is already set to 'pending' in the INSERT statement above
      console.log(`Expense created with pending status - requires daily approval. ID: ${expenseRow.id}`);

      console.log('Expense creation completed successfully');

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
      // Error occurred during expense creation
      console.error('Add expense error:', error);
      if (error instanceof Error && error.name === 'APIError') {
        throw error;
      }
      throw APIError.internal("Failed to add expense");
    }
  }
);

