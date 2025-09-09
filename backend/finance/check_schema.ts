import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

// Temporary endpoint to check the current database schema (no auth required for testing)
export const checkSchema = api(
  { auth: false, expose: true, method: "GET", path: "/finance/check-schema" },
  async () => {
    try {
      console.log("Checking current database schema...");
      
      const schema = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name IN ('expense_date', 'expense_date_new')
        ORDER BY column_name
      `;
      
      console.log("Current schema:", schema);
      
      return { 
        message: "Schema check completed",
        schema: schema,
        needsMigration: schema.some(col => col.column_name === 'expense_date' && col.data_type === 'date')
      };
    } catch (error) {
      console.error('Schema check error:', error);
      throw APIError.internal(`Schema check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
