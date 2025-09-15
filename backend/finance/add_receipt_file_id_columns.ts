import { api, APIError } from "encore.dev/api";
import { financeDB } from "./db";

export interface AddReceiptFileIdColumnsResponse {
  success: boolean;
  message: string;
  results: string[];
}

// API endpoint to add receipt_file_id columns to revenues and expenses tables
export const addReceiptFileIdColumns = api<{}, AddReceiptFileIdColumnsResponse>(
  { auth: false, expose: true, method: "POST", path: "/finance/add-receipt-file-id-columns" },
  async () => {
    try {
      const results: string[] = [];

      // Add receipt_file_id to revenues table if it doesn't exist
      try {
        await financeDB.exec`
          ALTER TABLE revenues ADD COLUMN receipt_file_id BIGINT
        `;
        results.push('Added receipt_file_id to revenues table');
        console.log('✓ Added receipt_file_id to revenues table');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push('receipt_file_id already exists in revenues table');
          console.log('✓ receipt_file_id already exists in revenues table');
        } else {
          throw error;
        }
      }

      // Add receipt_file_id to expenses table if it doesn't exist
      try {
        await financeDB.exec`
          ALTER TABLE expenses ADD COLUMN receipt_file_id BIGINT
        `;
        results.push('Added receipt_file_id to expenses table');
        console.log('✓ Added receipt_file_id to expenses table');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push('receipt_file_id already exists in expenses table');
          console.log('✓ receipt_file_id already exists in expenses table');
        } else {
          throw error;
        }
      }

      // Add foreign key constraints if they don't exist
      try {
        await financeDB.exec`
          ALTER TABLE revenues ADD CONSTRAINT fk_revenues_receipt_file_id 
          FOREIGN KEY (receipt_file_id) REFERENCES files(id) ON DELETE SET NULL
        `;
        results.push('Added foreign key constraint for revenues.receipt_file_id');
        console.log('✓ Added foreign key constraint for revenues.receipt_file_id');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push('Foreign key constraint already exists for revenues.receipt_file_id');
          console.log('✓ Foreign key constraint already exists for revenues.receipt_file_id');
        } else {
          console.log('Note: Could not add foreign key constraint for revenues:', error.message);
        }
      }

      try {
        await financeDB.exec`
          ALTER TABLE expenses ADD CONSTRAINT fk_expenses_receipt_file_id 
          FOREIGN KEY (receipt_file_id) REFERENCES files(id) ON DELETE SET NULL
        `;
        results.push('Added foreign key constraint for expenses.receipt_file_id');
        console.log('✓ Added foreign key constraint for expenses.receipt_file_id');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push('Foreign key constraint already exists for expenses.receipt_file_id');
          console.log('✓ Foreign key constraint already exists for expenses.receipt_file_id');
        } else {
          console.log('Note: Could not add foreign key constraint for expenses:', error.message);
        }
      }

      return {
        success: true,
        message: 'Receipt file ID columns added successfully',
        results: results
      };
    } catch (error: any) {
      console.error('Add receipt file ID columns error:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        results: []
      };
    }
  }
);

