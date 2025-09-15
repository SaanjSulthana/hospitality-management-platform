import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

// Simple test endpoint to check database without authentication
export const testSimple = api(
  { auth: false, expose: true, method: "GET", path: "/finance/test-simple" },
  async () => {
    try {
      console.log("Testing simple database connection...");
      
      // Test basic connection
      const connectionTest = await financeDB.queryRow`SELECT NOW() as current_time`;
      console.log("Database connection test:", connectionTest);
      
      // Check if revenues table exists
      const revenuesTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'revenues'
        )
      `;
      console.log("Revenues table exists:", revenuesTableExists?.exists);
      
      // Check if expenses table exists
      const expensesTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expenses'
        )
      `;
      console.log("Expenses table exists:", expensesTableExists?.exists);
      
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
      
      return {
        message: "Simple database test completed",
        connectionTest,
        revenuesTableExists: revenuesTableExists?.exists || false,
        expensesTableExists: expensesTableExists?.exists || false,
        revenuesSchema,
        expensesSchema
      };
    } catch (error) {
      console.error('Simple database test error:', error);
      return {
        message: "Simple database test failed",
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }
);

