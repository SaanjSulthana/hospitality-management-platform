import { api, APIError } from "encore.dev/api";
import { reportsDB } from "./db";

// Check the current database schema for daily_cash_balances table
export const checkSchema = api(
  { auth: false, expose: true, method: "GET", path: "/reports/check-schema" },
  async () => {
    try {
      console.log("Checking current database schema...");
      
      // Check if daily_cash_balances table exists
      const tableExists = await reportsDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'daily_cash_balances'
        ) as table_exists
      `;
      
      if (!tableExists?.table_exists) {
        return { 
          message: "daily_cash_balances table does not exist",
          tableExists: false,
          needsInitialMigration: true
        };
      }
      
      // Check current schema of the table
      const schema = await reportsDB.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'daily_cash_balances'
        ORDER BY column_name
      `;
      
      console.log("Current schema:", schema);
      
      // Check if our new columns exist
      const hasNewColumns = schema.some(col => 
        col.column_name === 'is_opening_balance_auto_calculated' ||
        col.column_name === 'calculated_closing_balance_cents' ||
        col.column_name === 'balance_discrepancy_cents'
      );
      
      return { 
        message: "Schema check completed",
        tableExists: true,
        schema: schema,
        hasNewColumns: hasNewColumns,
        needsEnhancementMigration: !hasNewColumns
      };
    } catch (error) {
      console.error('Schema check error:', error);
      throw APIError.internal(`Schema check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
