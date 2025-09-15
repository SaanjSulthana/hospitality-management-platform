import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface RunPaymentMigrationResponse {
  success: boolean;
  message: string;
  results: any[];
}

// Run the payment mode migration manually
export const runPaymentMigration = api<{}, RunPaymentMigrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/run-payment-migration" },
  async () => {
    console.log('=== RUNNING PAYMENT MIGRATION ===');
    
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      const results: any[] = [];

      // Check if columns already exist
      const revenuesColumns = await financeDB.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'revenues' AND table_schema = 'public' AND column_name IN ('payment_mode', 'bank_reference')
      `;

      const expensesColumns = await financeDB.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND table_schema = 'public' AND column_name IN ('payment_mode', 'bank_reference')
      `;

      console.log('Existing columns:', { revenuesColumns, expensesColumns });

      // Add payment_mode to revenues if it doesn't exist
      if (!revenuesColumns.some((col: any) => col.column_name === 'payment_mode')) {
        console.log('Adding payment_mode to revenues table');
        await financeDB.exec`
          ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'))
        `;
        results.push('Added payment_mode to revenues table');
      } else {
        results.push('payment_mode already exists in revenues table');
      }

      // Add bank_reference to revenues if it doesn't exist
      if (!revenuesColumns.some((col: any) => col.column_name === 'bank_reference')) {
        console.log('Adding bank_reference to revenues table');
        await financeDB.exec`
          ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255)
        `;
        results.push('Added bank_reference to revenues table');
      } else {
        results.push('bank_reference already exists in revenues table');
      }

      // Add payment_mode to expenses if it doesn't exist
      if (!expensesColumns.some((col: any) => col.column_name === 'payment_mode')) {
        console.log('Adding payment_mode to expenses table');
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'))
        `;
        results.push('Added payment_mode to expenses table');
      } else {
        results.push('payment_mode already exists in expenses table');
      }

      // Add bank_reference to expenses if it doesn't exist
      if (!expensesColumns.some((col: any) => col.column_name === 'bank_reference')) {
        console.log('Adding bank_reference to expenses table');
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255)
        `;
        results.push('Added bank_reference to expenses table');
      } else {
        results.push('bank_reference already exists in expenses table');
      }

      // Update existing records to have default payment_mode
      const updateRevenues = await financeDB.exec`
        UPDATE revenues SET payment_mode = 'cash' WHERE payment_mode IS NULL
      `;
      results.push(`Updated ${updateRevenues.rowCount} revenue records with default payment_mode`);

      const updateExpenses = await financeDB.exec`
        UPDATE expenses SET payment_mode = 'cash' WHERE payment_mode IS NULL
      `;
      results.push(`Updated ${updateExpenses.rowCount} expense records with default payment_mode`);

      console.log('Migration completed successfully');
      return {
        success: true,
        message: "Payment mode migration completed successfully",
        results
      };
    } catch (error) {
      console.error('Error running payment migration:', error);
      throw APIError.internal(`Failed to run payment migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

