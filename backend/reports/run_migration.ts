import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { reportsDB } from "./db";
import { requireRole } from "../auth/middleware";

// Temporary endpoint to run the database migration for daily cash balances enhancement
export const runMigration = api(
  { auth: true, expose: true, method: "POST", path: "/reports/run-migration" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await reportsDB.begin();
    try {
      console.log("Starting migration to enhance daily cash balances...");
      
      // First, check the current schema
      const currentSchema = await tx.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'daily_cash_balances' 
          AND column_name IN ('is_opening_balance_auto_calculated', 'calculated_closing_balance_cents', 'balance_discrepancy_cents')
        ORDER BY column_name
      `;
      
      console.log("Current schema:", currentSchema);
      
      // Check if the new columns already exist
      const checkColumns = await tx.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'daily_cash_balances' 
          AND column_name IN ('is_opening_balance_auto_calculated', 'calculated_closing_balance_cents', 'balance_discrepancy_cents')
      `;
      
      if (checkColumns.length === 3) {
        console.log("Migration already applied, skipping...");
        await tx.commit();
        return { message: "Migration already applied", schema: currentSchema };
      }

      // Step 1: Add new columns
      console.log("Step 1: Adding new columns...");
      await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE`;
      await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN calculated_closing_balance_cents INTEGER`;
      await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN balance_discrepancy_cents INTEGER DEFAULT 0`;
      
      // Step 2: Add index for efficient previous day lookups
      console.log("Step 2: Adding index...");
      await tx.exec`CREATE INDEX idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date DESC)`;
      
      // Step 3: Add comments to explain the new fields
      console.log("Step 3: Adding column comments...");
      await tx.exec`COMMENT ON COLUMN daily_cash_balances.is_opening_balance_auto_calculated IS 'True if opening balance was automatically calculated from previous day, false if manually set'`;
      await tx.exec`COMMENT ON COLUMN daily_cash_balances.calculated_closing_balance_cents IS 'The closing balance as calculated from opening + cash revenue - cash expenses'`;
      await tx.exec`COMMENT ON COLUMN daily_cash_balances.balance_discrepancy_cents IS 'Difference between manual closing balance and calculated closing balance'`;
      
      await tx.commit();
      console.log("Migration completed successfully!");
      
      return { 
        message: "Migration completed successfully", 
        schema: currentSchema,
        addedColumns: [
          'is_opening_balance_auto_calculated',
          'calculated_closing_balance_cents', 
          'balance_discrepancy_cents'
        ],
        addedIndex: 'idx_daily_cash_balances_prev_day'
      };
    } catch (error) {
      await tx.rollback();
      console.error('Migration error:', error);
      throw APIError.internal(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
