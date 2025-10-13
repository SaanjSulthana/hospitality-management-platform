import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";

export const addMissingColumns = api<{}, { success: boolean; message: string }>(
  { auth: true, expose: true, method: "POST", path: "/finance/add-missing-columns" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw new Error("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      console.log('Adding missing columns to expenses and revenues tables...');
      
      // Add status column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
      `;
      
      // Add payment_mode column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'cash'
      `;
      
      // Add bank_reference column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255)
      `;
      
      // Add receipt_file_id column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER
      `;
      
      // Add approved_by_user_id column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER
      `;
      
      // Add approved_at column to expenses table
      await financeDB.exec`
        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
      `;
      
      // Add status column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
      `;
      
      // Add payment_mode column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'cash'
      `;
      
      // Add bank_reference column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255)
      `;
      
      // Add receipt_file_id column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER
      `;
      
      // Add approved_by_user_id column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER
      `;
      
      // Add approved_at column to revenues table
      await financeDB.exec`
        ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
      `;
      
      console.log('All missing columns added successfully');
      
      return {
        success: true,
        message: "All missing columns added successfully to expenses and revenues tables"
      };
    } catch (error) {
      console.error('Error adding missing columns:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
);
