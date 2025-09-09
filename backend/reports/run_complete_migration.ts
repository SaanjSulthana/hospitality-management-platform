import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { reportsDB } from "./db";
import { requireRole } from "../auth/middleware";

// Complete migration that handles both initial table creation and enhancements
export const runCompleteMigration = api(
  { auth: true, expose: true, method: "POST", path: "/reports/run-complete-migration" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await reportsDB.begin();
    try {
      console.log("Starting complete migration for daily cash balances...");
      
      // Step 1: Check if daily_cash_balances table exists
      const tableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'daily_cash_balances'
        ) as table_exists
      `;
      
      let step1Result = "Skipped - table already exists";
      
      if (!tableExists?.table_exists) {
        console.log("Step 1: Creating daily_cash_balances table...");
        
        // Create the daily_cash_balances table (from migration 8)
        await tx.exec`
          CREATE TABLE daily_cash_balances (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL,
            property_id INTEGER NOT NULL,
            balance_date DATE NOT NULL,
            opening_balance_cents INTEGER DEFAULT 0,
            cash_received_cents INTEGER DEFAULT 0,
            bank_received_cents INTEGER DEFAULT 0,
            cash_expenses_cents INTEGER DEFAULT 0,
            bank_expenses_cents INTEGER DEFAULT 0,
            closing_balance_cents INTEGER DEFAULT 0,
            created_by_user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            
            CONSTRAINT fk_daily_cash_balances_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
            CONSTRAINT fk_daily_cash_balances_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
            CONSTRAINT fk_daily_cash_balances_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id),
            
            UNIQUE(org_id, property_id, balance_date)
          )
        `;
        
        // Create indexes
        await tx.exec`CREATE INDEX idx_daily_cash_balances_org_date ON daily_cash_balances(org_id, balance_date)`;
        await tx.exec`CREATE INDEX idx_daily_cash_balances_property_date ON daily_cash_balances(property_id, balance_date)`;
        
        step1Result = "Completed - table created";
      }
      
      // Step 2: Check if enhancement columns exist
      const enhancementColumns = await tx.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'daily_cash_balances' 
          AND column_name IN ('is_opening_balance_auto_calculated', 'calculated_closing_balance_cents', 'balance_discrepancy_cents')
      `;
      
      let step2Result = "Skipped - columns already exist";
      
      if (enhancementColumns.length < 3) {
        console.log("Step 2: Adding enhancement columns...");
        
        // Add enhancement columns
        await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE`;
        await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN calculated_closing_balance_cents INTEGER`;
        await tx.exec`ALTER TABLE daily_cash_balances ADD COLUMN balance_discrepancy_cents INTEGER DEFAULT 0`;
        
        // Add index for efficient previous day lookups
        await tx.exec`CREATE INDEX idx_daily_cash_balances_prev_day ON daily_cash_balances(org_id, property_id, balance_date DESC)`;
        
        // Add comments
        await tx.exec`COMMENT ON COLUMN daily_cash_balances.is_opening_balance_auto_calculated IS 'True if opening balance was automatically calculated from previous day, false if manually set'`;
        await tx.exec`COMMENT ON COLUMN daily_cash_balances.calculated_closing_balance_cents IS 'The closing balance as calculated from opening + cash revenue - cash expenses'`;
        await tx.exec`COMMENT ON COLUMN daily_cash_balances.balance_discrepancy_cents IS 'Difference between manual closing balance and calculated closing balance'`;
        
        step2Result = "Completed - enhancement columns added";
      }
      
      await tx.commit();
      console.log("Complete migration finished successfully!");
      
      return { 
        message: "Complete migration finished successfully!",
        step1: step1Result,
        step2: step2Result,
        tableExists: true,
        enhancementColumnsAdded: enhancementColumns.length < 3
      };
    } catch (error) {
      await tx.rollback();
      console.error('Complete migration error:', error);
      throw APIError.internal(`Complete migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
