import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

export interface RunMigrationNoAuthResponse {
  success: boolean;
  message: string;
  results: string[];
}

// API endpoint to run the payment mode migration without authentication
export const runMigrationNoAuth = api<{}, RunMigrationNoAuthResponse>(
  { auth: false, expose: true, method: "POST", path: "/finance/run-migration-no-auth" },
  async () => {
    console.log('=== RUNNING MIGRATION WITHOUT AUTH ===');
    
    try {
      const results: string[] = [];

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
        console.log('✓ Added payment_mode to revenues table');
      } else {
        results.push('payment_mode already exists in revenues table');
        console.log('✓ payment_mode already exists in revenues table');
      }

      // Add bank_reference to revenues if it doesn't exist
      if (!revenuesColumns.some((col: any) => col.column_name === 'bank_reference')) {
        console.log('Adding bank_reference to revenues table');
        await financeDB.exec`
          ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255)
        `;
        results.push('Added bank_reference to revenues table');
        console.log('✓ Added bank_reference to revenues table');
      } else {
        results.push('bank_reference already exists in revenues table');
        console.log('✓ bank_reference already exists in revenues table');
      }

      // Add payment_mode to expenses if it doesn't exist
      if (!expensesColumns.some((col: any) => col.column_name === 'payment_mode')) {
        console.log('Adding payment_mode to expenses table');
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'))
        `;
        results.push('Added payment_mode to expenses table');
        console.log('✓ Added payment_mode to expenses table');
      } else {
        results.push('payment_mode already exists in expenses table');
        console.log('✓ payment_mode already exists in expenses table');
      }

      // Add bank_reference to expenses if it doesn't exist
      if (!expensesColumns.some((col: any) => col.column_name === 'bank_reference')) {
        console.log('Adding bank_reference to expenses table');
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255)
        `;
        results.push('Added bank_reference to expenses table');
        console.log('✓ Added bank_reference to expenses table');
      } else {
        results.push('bank_reference already exists in expenses table');
        console.log('✓ bank_reference already exists in expenses table');
      }

      // Update existing records to have default payment_mode
      const updateRevenues = await financeDB.exec`
        UPDATE revenues SET payment_mode = 'cash' WHERE payment_mode IS NULL
      `;
      results.push(`Updated ${updateRevenues.rowCount} revenue records with default payment_mode`);
      console.log(`✓ Updated ${updateRevenues.rowCount} revenue records with default payment_mode`);

      const updateExpenses = await financeDB.exec`
        UPDATE expenses SET payment_mode = 'cash' WHERE payment_mode IS NULL
      `;
      results.push(`Updated ${updateExpenses.rowCount} expense records with default payment_mode`);
      console.log(`✓ Updated ${updateExpenses.rowCount} expense records with default payment_mode`);

      console.log('🎉 Payment mode migration completed successfully!');
      
      // Verify the migration
      const sampleRevenue = await financeDB.queryRow`
        SELECT id, payment_mode, bank_reference, amount_cents, source
        FROM revenues 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const sampleExpense = await financeDB.queryRow`
        SELECT id, payment_mode, bank_reference, amount_cents, category
        FROM expenses 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      console.log('Sample revenue after migration:', sampleRevenue);
      console.log('Sample expense after migration:', sampleExpense);

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

