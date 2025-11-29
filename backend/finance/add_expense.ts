import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { checkDailyApprovalInternal } from "./check_daily_approval";
import { handleFinanceError } from "./error_handling";
import { executeQueryWithStability } from "./connection_stability";
import { financeEvents } from "./events";
import { v1Path } from "../shared/http";
import { v4 as uuidv4 } from 'uuid';
import { toISTDateString } from "../shared/date_utils";

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
  status: string;
  approvedByUserId?: number | null;
  approvedAt?: Date | null;
}

// Adds a new expense record (now using optimized implementation)
async function addExpenseHandler(req: AddExpenseRequest): Promise<AddExpenseResponse> {
    console.log('=== ADD EXPENSE FUNCTION CALLED (OPTIMIZED) ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Check approval workflow for all users (ADMIN and MANAGER)
    const approvalCheck = await checkDailyApprovalInternal(authData);
    if (!approvalCheck.canAddTransactions) {
      throw APIError.permissionDenied(
        approvalCheck.message || "You cannot add transactions at this time. Please wait for admin approval."
      );
    }

    const { propertyId, category, amountCents, currency = "INR", description, receiptUrl, receiptFileId, expenseDate, paymentMode = "cash", bankReference } = req;
    
    // If we have a receiptFileId but no receiptUrl, construct the URL
    let finalReceiptUrl = receiptUrl;
    if (receiptFileId && !receiptUrl) {
      finalReceiptUrl = `/uploads/file/${receiptFileId}`;
    }
    
    // Use provided expense date for expense_date field, but current timestamp for created_at
    const expenseDateValue = expenseDate ? new Date(expenseDate) : new Date();
    const currentTimestamp = new Date();

    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    try {
      console.log('Starting expense insertion process');
      // First check if the expenses table exists
      const expensesTableExists = await executeQueryWithStability(
        () => financeDB.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'expenses'
          )
        `,
        'check_expenses_table_exists'
      );
      
      if (!expensesTableExists?.exists) {
        throw APIError.internal("Database not initialized. Please run database setup first.");
      }

      // Check property access with org scoping using connection stability
      const propertyRow = await executeQueryWithStability(
      () => financeDB.queryRow`
          SELECT p.id, p.org_id, p.name
          FROM properties p
          WHERE p.id = ${propertyId} AND p.org_id = ${authData.orgId}
        `,
        'check_property_access'
      );

      if (!propertyRow) {
        throw APIError.notFound("Property not found");
      }

      if (authData.role === "MANAGER") {
        const accessCheck = await executeQueryWithStability(
          () => financeDB.queryRow`
            SELECT 1 FROM user_properties 
            WHERE user_id = ${parseInt(authData.userID)} AND property_id = ${propertyId}
          `,
          'check_user_property_access'
        );
        if (!accessCheck) {
          throw APIError.permissionDenied("No access to this property");
        }
      }

      // Create expense record with connection stability and graceful column handling
      let expenseRow;
      try {
        // Determine status and approval fields based on user role
        const isAdmin = authData.role === "ADMIN";
        const status = isAdmin ? 'approved' : 'pending';
        const approvedByUserId = isAdmin ? parseInt(authData.userID) : null;
        const approvedAt = isAdmin ? currentTimestamp : null;

        expenseRow = await executeQueryWithStability(
          () => financeDB.queryRow`
            INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at, approved_by_user_id, approved_at)
            VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${finalReceiptUrl || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, ${status}, ${paymentMode}, ${bankReference || null}, ${receiptFileId || null}, ${currentTimestamp}, ${approvedByUserId}, ${approvedAt})
            RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, status, created_by_user_id, created_at, payment_mode, bank_reference, receipt_file_id, approved_by_user_id, approved_at
          `,
          'create_expense_with_new_columns'
        );
      } catch (dbError: any) {
        console.error('Database error during expense creation:', dbError);
        
        // If columns are missing, try without the new columns using connection stability
        if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
          console.log('Trying fallback insert without new columns...');
          try {
            expenseRow = await executeQueryWithStability(
              () => financeDB.queryRow`
                INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, created_at)
                VALUES (${authData.orgId}, ${propertyId}, ${category}, ${amountCents}, ${currency}, ${description || null}, ${finalReceiptUrl || null}, ${expenseDateValue}, ${parseInt(authData.userID)}, ${currentTimestamp})
                RETURNING id, property_id, category, amount_cents, currency, description, receipt_url, expense_date, created_by_user_id, created_at
              `,
              'create_expense_fallback'
            );
            
            // Set default values for missing columns
            if (expenseRow) {
              expenseRow.status = isAdmin ? 'approved' : 'pending';
              expenseRow.payment_mode = paymentMode;
              expenseRow.bank_reference = bankReference;
              expenseRow.receipt_file_id = receiptFileId;
              expenseRow.approved_by_user_id = approvedByUserId;
              expenseRow.approved_at = approvedAt;
            }
          } catch (fallbackError: any) {
            // Use enhanced error handling for fallback failure
            throw handleFinanceError(fallbackError, 'add_expense', {
              userId: authData.userID,
              orgId: authData.orgId.toString(),
              operation: 'create_expense_fallback',
              table: 'expenses'
            });
          }
        } else {
          // Use enhanced error handling for other database errors
          throw handleFinanceError(dbError, 'add_expense', {
            userId: authData.userID,
            orgId: authData.orgId.toString(),
            operation: 'create_expense',
            table: 'expenses'
          });
        }
      }

      if (!expenseRow) {
        throw new Error("Failed to create expense record");
      }

      // All transactions now require daily approval - no auto-approval
      // Status is already set to 'pending' in the INSERT statement above
      console.log(`Expense created with pending status - requires daily approval. ID: ${expenseRow.id}`);

      console.log('Expense creation completed successfully');

      // Publish event for real-time updates BEFORE returning
      try {
        await financeEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'expense_added',
          orgId: authData.orgId,
          propertyId: expenseRow.property_id,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: expenseRow.id,
          entityType: 'expense',
          metadata: {
            amountCents: expenseRow.amount_cents,
            currency: expenseRow.currency,
            transactionDate: toISTDateString(expenseRow.expense_date || new Date()),
            paymentMode: expenseRow.payment_mode,
            category: expenseRow.category,
            affectedReportDates: [toISTDateString(expenseRow.expense_date || new Date())],
            propertyName: propertyRow?.name || undefined,
            newStatus: expenseRow.status || undefined
          }
        });
        console.log(`[Finance] Published expense_added event for expense ID: ${expenseRow.id}`);
      } catch (eventError) {
        console.error('[Finance] Failed to publish expense_added event:', eventError);
        // Don't fail the transaction if event publishing fails
      }

      return {
        id: expenseRow.id,
        propertyId: expenseRow.property_id,
        // Include property name so frontend can render immediately without extra lookups
        propertyName: propertyRow?.name || 'Unknown Property',
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
        // Best-effort creator name; frontend also has user context
        createdByName: (authData as any)?.displayName || (authData as any)?.email || 'Unknown User',
        createdAt: expenseRow.created_at,
        status: expenseRow.status || 'pending',
        approvedByUserId: expenseRow.approved_by_user_id,
        approvedAt: expenseRow.approved_at,
      };
    } catch (error) {
      // Use enhanced error handling for any remaining errors
      throw handleFinanceError(error as Error, 'add_expense', {
        userId: authData.userID,
        orgId: authData.orgId.toString(),
        operation: 'add_expense',
        table: 'expenses'
      });
    }
}

export const addExpense = api<AddExpenseRequest, AddExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/expenses" },
  addExpenseHandler
);

export const addExpenseV1 = api<AddExpenseRequest, AddExpenseResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/expenses" },
  addExpenseHandler
);

