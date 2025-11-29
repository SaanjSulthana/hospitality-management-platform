import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { handleFinanceError, executeWithRetry, generateFallbackQuery, isSchemaError } from "./error_handling";
import { v1Path } from "../shared/http";

interface ListExpensesRequest {
  propertyId?: number;
  category?: string;
  status?: string;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
}

export interface ExpenseInfo {
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
  paymentMode?: string;
  bankReference?: string;
  status: string;
  createdByUserId: number;
  createdByName: string;
  approvedByUserId?: number;
  approvedByName?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export interface ListExpensesResponse {
  expenses: ExpenseInfo[];
  totalAmount: number;
}

// Lists expenses with filtering
async function listExpensesHandler(req: ListExpensesRequest): Promise<ListExpensesResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, category, status, startDate, endDate } = req || {};

    console.log('List expenses request:', { propertyId, category, status, startDate, endDate, orgId: authData.orgId });

    // Use full query with all columns (they are guaranteed to exist after migrations)
    let query = `
      SELECT
        e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
        e.description, e.receipt_url, e.receipt_file_id, e.expense_date,
        e.payment_mode, e.bank_reference,
        COALESCE(e.status, 'pending') as status, e.created_by_user_id, e.approved_by_user_id, e.approved_at, e.created_at,
        u.display_name as created_by_name,
        au.display_name as approved_by_name
      FROM expenses e
      JOIN properties p ON e.property_id = p.id AND p.org_id = $1
      JOIN users u ON e.created_by_user_id = u.id AND u.org_id = $1
      LEFT JOIN users au ON e.approved_by_user_id = au.id AND au.org_id = $1
      WHERE e.org_id = $1
    `;
    const params: any[] = [authData.orgId];
    let paramIndex = 2;

    try {

      // Managers can only see expenses for properties they have access to
      if (authData.role === "MANAGER") {
        query += ` AND p.id IN (
          SELECT property_id FROM user_properties WHERE user_id = $${paramIndex}
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (propertyId) {
        query += ` AND e.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (category) {
        query += ` AND e.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (status) {
        query += ` AND e.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        // Use date string directly for PostgreSQL date comparison
        query += ` AND e.expense_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        // Use date string directly for PostgreSQL date comparison
        query += ` AND e.expense_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY e.created_at DESC, e.expense_date DESC`;

      console.log('Executing expenses query:', query);
      console.log('Query params:', params);
      
      // Execute query with retry logic for connection issues
      const expenses = await executeWithRetry(
        () => financeDB.rawQueryAll(query, ...params),
        3, // max retries
        1000 // delay between retries
      );
      
      console.log('Query result count:', expenses.length);

      // Calculate total amount for all expenses (including pending)
      const totalAmount = expenses
        .reduce((sum, expense) => sum + (parseInt(expense.amount_cents) || 0), 0);

      return {
        expenses: expenses.map((expense) => ({
          id: expense.id,
          propertyId: expense.property_id,
          propertyName: expense.property_name,
          category: expense.category,
          amountCents: parseInt(expense.amount_cents),
          currency: expense.currency,
          description: expense.description,
          receiptUrl: expense.receipt_url,
          receiptFileId: expense.receipt_file_id,
          expenseDate: expense.expense_date,
          paymentMode: expense.payment_mode || 'cash',
          bankReference: expense.bank_reference,
          status: expense.status || 'pending',
          createdByUserId: expense.created_by_user_id,
          createdByName: expense.created_by_name,
          approvedByUserId: expense.approved_by_user_id,
          approvedByName: expense.approved_by_name,
          approvedAt: expense.approved_at,
          createdAt: expense.created_at,
        })),
        totalAmount,
      };
    } catch (error) {
      // Handle schema errors with fallback query
      if (isSchemaError(error as Error)) {
        console.log('Schema error detected, attempting fallback query...');
        try {
          // Try with a simplified query without new columns
          const fallbackQuery = generateFallbackQuery(query, ['status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at']);
          console.log('Executing fallback query:', fallbackQuery);
          
          const fallbackExpenses = await executeWithRetry(
            () => financeDB.rawQueryAll(fallbackQuery, params[0]), // Only pass orgId parameter
            3,
            1000
          );
          
          const totalAmount = fallbackExpenses
            .reduce((sum, expense) => sum + (parseInt(expense.amount_cents) || 0), 0);

          return {
            expenses: fallbackExpenses.map((expense) => ({
              id: expense.id,
              propertyId: expense.property_id,
              propertyName: expense.property_name,
              category: expense.category,
              amountCents: parseInt(expense.amount_cents),
              currency: expense.currency,
              description: expense.description,
              receiptUrl: expense.receipt_url,
              receiptFileId: null, // Not available in fallback
              expenseDate: expense.expense_date,
              paymentMode: 'cash', // Default value
              bankReference: null, // Not available in fallback
              status: 'pending', // Default value
              createdByUserId: expense.created_by_user_id,
              createdByName: expense.created_by_name,
              approvedByUserId: null, // Not available in fallback
              approvedByName: null, // Not available in fallback
              approvedAt: null, // Not available in fallback
              createdAt: expense.created_at,
            })),
            totalAmount,
          };
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          // If fallback also fails, use enhanced error handling
          const fallbackQuery = generateFallbackQuery(query, ['status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at']);
          throw handleFinanceError(fallbackError as Error, 'list_expenses', {
            userId: authData.userID,
            orgId: authData.orgId.toString(),
            query: fallbackQuery,
            table: 'expenses'
          });
        }
      }
      
      // Use enhanced error handling for all other errors
      throw handleFinanceError(error as Error, 'list_expenses', {
        userId: authData.userID,
        orgId: authData.orgId.toString(),
        query,
        table: 'expenses'
      });
    }
}

// Legacy path (kept during migration window)
export const listExpenses = api<ListExpensesRequest, ListExpensesResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/expenses" },
  listExpensesHandler
);

// Versioned path
export const listExpensesV1 = api<ListExpensesRequest, ListExpensesResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/expenses" },
  listExpensesHandler
);

