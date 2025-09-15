import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface TestDbSchemaResponse {
  revenuesTableExists: boolean;
  expensesTableExists: boolean;
  revenuesColumns: string[];
  expensesColumns: string[];
  sampleRevenueCount: number;
  sampleExpenseCount: number;
  error?: string;
}

// Test database schema and table access
export const testDbSchema = api<{}, TestDbSchemaResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/test-db-schema" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const tx = await financeDB.begin();
    try {
      // Check if revenues table exists
      const revenuesTableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'revenues'
        )
      `;

      // Check if expenses table exists
      const expensesTableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expenses'
        )
      `;

      // Get revenues table columns
      const revenuesColumns = await tx.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'revenues'
        ORDER BY ordinal_position
      `;

      // Get expenses table columns
      const expensesColumns = await tx.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses'
        ORDER BY ordinal_position
      `;

      // Get sample counts
      let sampleRevenueCount = 0;
      let sampleExpenseCount = 0;

      if (revenuesTableExists?.exists) {
        const revenueCount = await tx.queryRow`
          SELECT COUNT(*) as count FROM revenues WHERE org_id = ${authData.orgId}
        `;
        sampleRevenueCount = revenueCount?.count || 0;
      }

      if (expensesTableExists?.exists) {
        const expenseCount = await tx.queryRow`
          SELECT COUNT(*) as count FROM expenses WHERE org_id = ${authData.orgId}
        `;
        sampleExpenseCount = expenseCount?.count || 0;
      }

      await tx.commit();

      return {
        revenuesTableExists: revenuesTableExists?.exists || false,
        expensesTableExists: expensesTableExists?.exists || false,
        revenuesColumns: revenuesColumns.map((col: any) => col.column_name),
        expensesColumns: expensesColumns.map((col: any) => col.column_name),
        sampleRevenueCount,
        sampleExpenseCount,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Test DB schema error:', error);
      return {
        revenuesTableExists: false,
        expensesTableExists: false,
        revenuesColumns: [],
        expensesColumns: [],
        sampleRevenueCount: 0,
        sampleExpenseCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);

