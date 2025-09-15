import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Ensure all required columns exist in the database
export const ensureSchema = api(
  { auth: true, expose: true, method: "POST", path: "/finance/ensure-schema" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await financeDB.begin();
    try {
      console.log("Ensuring database schema is up to date...");
      
      // Check and add missing columns to revenues table
      const revenueColumns = [
        { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending\' NOT NULL' },
        { name: 'approved_by_user_id', type: 'INTEGER' },
        { name: 'approved_at', type: 'TIMESTAMP' },
        { name: 'payment_mode', type: 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))' },
        { name: 'bank_reference', type: 'VARCHAR(255)' },
        { name: 'receipt_file_id', type: 'INTEGER' }
      ];

      for (const column of revenueColumns) {
        const exists = await tx.queryRow`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'revenues' AND column_name = ${column.name}
        `;
        
        if (!exists) {
          console.log(`Adding column ${column.name} to revenues table...`);
          await tx.exec`ALTER TABLE revenues ADD COLUMN ${column.name} ${column.type}`;
        } else {
          console.log(`Column ${column.name} already exists in revenues table`);
        }
      }

      // Check and add missing columns to expenses table
      const expenseColumns = [
        { name: 'payment_mode', type: 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))' },
        { name: 'bank_reference', type: 'VARCHAR(255)' },
        { name: 'receipt_file_id', type: 'INTEGER' }
      ];

      for (const column of expenseColumns) {
        const exists = await tx.queryRow`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'expenses' AND column_name = ${column.name}
        `;
        
        if (!exists) {
          console.log(`Adding column ${column.name} to expenses table...`);
          await tx.exec`ALTER TABLE expenses ADD COLUMN ${column.name} ${column.type}`;
        } else {
          console.log(`Column ${column.name} already exists in expenses table`);
        }
      }

      // Add foreign key constraints if they don't exist
      try {
        await tx.exec`
          ALTER TABLE revenues 
          ADD CONSTRAINT fk_revenues_approved_by_user_id 
          FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
        `;
        console.log("Added foreign key constraint for revenues.approved_by_user_id");
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log("Foreign key constraint for revenues.approved_by_user_id already exists");
        } else {
          console.warn("Could not add foreign key constraint for revenues.approved_by_user_id:", error.message);
        }
      }

      // Update existing records to have default values
      await tx.exec`UPDATE revenues SET payment_mode = 'cash' WHERE payment_mode IS NULL`;
      await tx.exec`UPDATE expenses SET payment_mode = 'cash' WHERE payment_mode IS NULL`;
      await tx.exec`UPDATE revenues SET status = 'pending' WHERE status IS NULL`;

      await tx.commit();
      console.log("Schema update completed successfully!");
      
      return { 
        message: "Database schema updated successfully",
        revenueColumns: revenueColumns.length,
        expenseColumns: expenseColumns.length
      };
    } catch (error) {
      await tx.rollback();
      console.error('Schema update error:', error);
      throw APIError.internal(`Schema update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

