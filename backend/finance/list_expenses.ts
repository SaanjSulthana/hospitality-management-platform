import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface ListExpensesRequest {
  propertyId?: Query&lt;number&gt;;
  category?: Query&lt;string&gt;;
  status?: Query&lt;string&gt;;
  startDate?: Query&lt;Date&gt;;
  endDate?: Query&lt;Date&gt;;
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
  expenseDate: Date;
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
export const listExpenses = api&lt;ListExpensesRequest, ListExpensesResponse&gt;(
  { auth: true, expose: true, method: "GET", path: "/finance/expenses" },
  async (req) =&gt; {
    const authData = getAuthData()!;
    const { propertyId, category, status, startDate, endDate } = req || {};

    try {
      let query = `
        SELECT 
          e.id, e.property_id, p.name as property_name, e.category, e.amount_cents, e.currency,
          e.description, e.receipt_url, e.expense_date, e.status, e.created_by_user_id,
          e.approved_by_user_id, e.approved_at, e.created_at,
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
        query += ` AND e.expense_date &gt;= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND e.expense_date &lt;= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

      const expenses = await financeDB.rawQueryAll(query, ...params);

      // Calculate total amount for approved expenses
      const totalAmount = expenses
        .filter(expense =&gt; expense.status === 'approved')
        .reduce((sum, expense) =&gt; sum + (parseInt(expense.amount_cents) || 0), 0);

      return {
        expenses: expenses.map((expense) =&gt; ({
          id: expense.id,
          propertyId: expense.property_id,
          propertyName: expense.property_name,
          category: expense.category,
          amountCents: parseInt(expense.amount_cents),
          currency: expense.currency,
          description: expense.description,
          receiptUrl: expense.receipt_url,
          expenseDate: expense.expense_date,
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
