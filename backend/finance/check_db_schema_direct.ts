import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface CheckDbSchemaDirectResponse {
  success: boolean;
  message: string;
  revenuesColumns: any[];
  expensesColumns: any[];
  sampleData: {
    revenue: any;
    expense: any;
  };
}

// Direct database schema check
export const checkDbSchemaDirect = api<{}, CheckDbSchemaDirectResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/check-db-schema-direct" },
  async () => {
    console.log('=== CHECKING DATABASE SCHEMA DIRECTLY ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      // Get all columns for revenues table
      const revenuesColumns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      // Get all columns for expenses table
      const expensesColumns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      // Get sample data
      const sampleRevenue = await financeDB.queryRow`
        SELECT * FROM revenues 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const sampleExpense = await financeDB.queryRow`
        SELECT * FROM expenses 
        WHERE org_id = ${authData.orgId}
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      console.log('Revenues columns:', revenuesColumns);
      console.log('Expenses columns:', expensesColumns);
      console.log('Sample revenue:', sampleRevenue);
      console.log('Sample expense:', sampleExpense);

      return {
        success: true,
        message: "Database schema checked successfully",
        revenuesColumns,
        expensesColumns,
        sampleData: {
          revenue: sampleRevenue,
          expense: sampleExpense
        }
      };
    } catch (error) {
      console.error('Error checking database schema:', error);
      throw APIError.internal(`Failed to check database schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

