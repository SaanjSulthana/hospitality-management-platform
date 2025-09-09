import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

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
  paymentMode: string;
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
export const listExpenses = api<ListExpensesRequest, ListExpensesResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/expenses" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { propertyId, category, status, startDate, endDate } = req || {};

    console.log('List expenses request:', { propertyId, category, status, startDate, endDate, orgId: authData.orgId });

    try {
      let query = `
        SELECT 
          e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
          e.description, e.receipt_url, e.receipt_file_id, e.expense_date, e.payment_mode, e.bank_reference,
          e.status, e.created_by_user_id, e.approved_by_user_id, e.approved_at, e.created_at,
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
        // Start of day: 00:00:00
        query += ` AND e.expense_date >= $${paramIndex}`;
        params.push(new Date(`${startDate}T00:00:00.000Z`));
        paramIndex++;
      }

      if (endDate) {
        // End of day: 23:59:59.999
        query += ` AND e.expense_date <= $${paramIndex}`;
        params.push(new Date(`${endDate}T23:59:59.999Z`));
        paramIndex++;
      }

      query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

      console.log('Executing expenses query:', query);
      console.log('Query params:', params);
      const expenses = await financeDB.rawQueryAll(query, ...params);
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
          paymentMode: expense.payment_mode,
          bankReference: expense.bank_reference,
          status: expense.status,
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
      console.error('List expenses error:', error);
      throw new Error('Failed to fetch expenses');
    }
  }
);

