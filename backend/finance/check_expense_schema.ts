import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface SchemaCheckResponse {
  success: boolean;
  tableExists: boolean;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>;
  sampleExpense: any;
}

// Check expenses table schema
export const checkExpenseSchema = api<{}, SchemaCheckResponse>(
  { auth: false, expose: true, method: "GET", path: "/finance/check-expense-schema" },
  async () => {
    try {
      // Check if table exists
      const tableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'expenses'
        ) as exists
      `;

      if (!tableExists?.exists) {
        return {
          success: false,
          tableExists: false,
          columns: [],
          sampleExpense: null
        };
      }

      // Get all columns
      const columns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'expenses'
        ORDER BY ordinal_position
      `;

      // Get a sample expense
      const sampleExpense = await financeDB.queryRow`
        SELECT * FROM expenses LIMIT 1
      `;

      return {
        success: true,
        tableExists: true,
        columns: columns.map((col: any) => ({
          column_name: col.column_name,
          data_type: col.data_type,
          is_nullable: col.is_nullable,
          column_default: col.column_default
        })),
        sampleExpense
      };

    } catch (error) {
      console.error('Schema check error:', error);
      return {
        success: false,
        tableExists: false,
        columns: [],
        sampleExpense: null
      };
    }
  }
);
