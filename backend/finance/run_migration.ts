import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Temporary endpoint to run the database migration
export const runMigration = api(
  { auth: true, expose: true, method: "POST", path: "/finance/run-migration" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await financeDB.begin();
    try {
      console.log("Starting migration to fix expense_date column...");
      
      // First, check the current schema
      const currentSchema = await tx.queryAll`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name IN ('expense_date', 'expense_date_new')
        ORDER BY column_name
      `;
      
      console.log("Current schema:", currentSchema);
      
      // Check if the new column already exists
      const checkColumn = await tx.queryRow`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'expense_date_new'
      `;
      
      if (checkColumn) {
        console.log("Migration already applied, skipping...");
        await tx.commit();
        return { message: "Migration already applied", schema: currentSchema };
      }

      // Check if expense_date is already TIMESTAMPTZ
      const expenseDateType = await tx.queryRow`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'expense_date'
      `;
      
      if (expenseDateType && expenseDateType.data_type === 'timestamp with time zone') {
        console.log("expense_date is already TIMESTAMPTZ, no migration needed");
        await tx.commit();
        return { message: "expense_date is already TIMESTAMPTZ", schema: currentSchema };
      }

      // Step 1: Add new column
      console.log("Step 1: Adding new column...");
      await tx.exec`ALTER TABLE expenses ADD COLUMN expense_date_new TIMESTAMPTZ`;
      
      // Step 2: Copy existing data
      console.log("Step 2: Copying existing data...");
      await tx.exec`UPDATE expenses SET expense_date_new = expense_date::TIMESTAMPTZ`;
      
      // Step 3: Make new column NOT NULL
      console.log("Step 3: Making new column NOT NULL...");
      await tx.exec`ALTER TABLE expenses ALTER COLUMN expense_date_new SET NOT NULL`;
      
      // Step 4: Drop old column
      console.log("Step 4: Dropping old column...");
      await tx.exec`ALTER TABLE expenses DROP COLUMN expense_date`;
      
      // Step 5: Rename new column
      console.log("Step 5: Renaming new column...");
      await tx.exec`ALTER TABLE expenses RENAME COLUMN expense_date_new TO expense_date`;
      
      await tx.commit();
      console.log("Migration completed successfully!");
      
      return { message: "Migration completed successfully", schema: currentSchema };
    } catch (error) {
      await tx.rollback();
      console.error('Migration error:', error);
      throw APIError.internal(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
