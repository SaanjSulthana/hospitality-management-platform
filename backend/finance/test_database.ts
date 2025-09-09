import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Test database connection and table structure
export const testDatabase = api(
  { auth: true, expose: true, method: "GET", path: "/finance/test-database" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      console.log("Testing database connection and structure...");
      
      // Test basic connection
      const connectionTest = await financeDB.queryRow`SELECT NOW() as current_time`;
      console.log("Database connection test:", connectionTest);
      
      // Check if notifications table exists
      const notificationsTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )
      `;
      console.log("Notifications table exists:", notificationsTableExists?.exists);
      
      // Check if daily_approvals table exists
      const dailyApprovalsTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'daily_approvals'
        )
      `;
      console.log("Daily approvals table exists:", dailyApprovalsTableExists?.exists);
      
      // Check revenues table structure
      const revenuesSchema = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'revenues'
        ORDER BY ordinal_position
      `;
      console.log("Revenues table schema:", revenuesSchema);
      
      // Check expenses table structure
      const expensesSchema = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'expenses'
        ORDER BY ordinal_position
      `;
      console.log("Expenses table schema:", expensesSchema);
      
      // Test a simple query on revenues
      const revenueCount = await financeDB.queryRow`
        SELECT COUNT(*) as count
        FROM revenues
        WHERE org_id = ${authData.orgId}
      `;
      console.log("Revenue count for org:", revenueCount?.count);
      
      // Test a simple query on expenses
      const expenseCount = await financeDB.queryRow`
        SELECT COUNT(*) as count
        FROM expenses
        WHERE org_id = ${authData.orgId}
      `;
      console.log("Expense count for org:", expenseCount?.count);
      
      return {
        message: "Database test completed",
        connectionTest,
        notificationsTableExists: notificationsTableExists?.exists || false,
        dailyApprovalsTableExists: dailyApprovalsTableExists?.exists || false,
        revenuesSchema,
        expensesSchema,
        revenueCount: revenueCount?.count || 0,
        expenseCount: expenseCount?.count || 0
      };
    } catch (error) {
      console.error('Database test error:', error);
      throw APIError.internal(`Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
