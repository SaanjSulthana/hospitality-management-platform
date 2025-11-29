import { api } from "encore.dev/api";
import { financeDB } from "./db";

export interface SchemaCheckResponse {
  expenses: {
    tableExists: boolean;
    requiredColumns: string[];
    missingColumns: string[];
    existingColumns: any[];
  };
  revenues: {
    tableExists: boolean;
    requiredColumns: string[];
    missingColumns: string[];
    existingColumns: any[];
  };
  summary: {
    allTablesExist: boolean;
    allColumnsExist: boolean;
    issues: string[];
  };
}

// Comprehensive schema check endpoint
export const checkSchemaComprehensive = api<{}, SchemaCheckResponse>(
  { auth: false, expose: true, method: "GET", path: "/finance/check-schema-comprehensive" },
  async () => {
    console.log("=== COMPREHENSIVE SCHEMA CHECK ===");
    
    // Required columns for expenses table
    const requiredExpenseColumns = [
      'id', 'org_id', 'property_id', 'category', 'amount_cents', 'currency',
      'description', 'receipt_url', 'expense_date', 'created_by_user_id', 'created_at',
      'status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at'
    ];
    
    // Required columns for revenues table
    const requiredRevenueColumns = [
      'id', 'org_id', 'property_id', 'source', 'amount_cents', 'currency',
      'description', 'receipt_url', 'occurred_at', 'created_by_user_id', 'created_at',
      'status', 'payment_mode', 'bank_reference', 'receipt_file_id', 'approved_by_user_id', 'approved_at'
    ];
    
    const issues: string[] = [];
    
    try {
      // Check expenses table
      console.log("Checking expenses table...");
      const expensesTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'expenses'
        )
      `;
      
      let expensesExistingColumns: any[] = [];
      let expensesMissingColumns: string[] = [];
      
      if (expensesTableExists?.exists) {
        expensesExistingColumns = await financeDB.queryAll`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'expenses'
          ORDER BY ordinal_position
        `;
        
        const existingColumnNames = expensesExistingColumns.map(col => col.column_name);
        expensesMissingColumns = requiredExpenseColumns.filter(col => !existingColumnNames.includes(col));
        
        if (expensesMissingColumns.length > 0) {
          issues.push(`Expenses table missing columns: ${expensesMissingColumns.join(', ')}`);
        }
      } else {
        issues.push("Expenses table does not exist");
      }
      
      // Check revenues table
      console.log("Checking revenues table...");
      const revenuesTableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'revenues'
        )
      `;
      
      let revenuesExistingColumns: any[] = [];
      let revenuesMissingColumns: string[] = [];
      
      if (revenuesTableExists?.exists) {
        revenuesExistingColumns = await financeDB.queryAll`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'revenues'
          ORDER BY ordinal_position
        `;
        
        const existingColumnNames = revenuesExistingColumns.map(col => col.column_name);
        revenuesMissingColumns = requiredRevenueColumns.filter(col => !existingColumnNames.includes(col));
        
        if (revenuesMissingColumns.length > 0) {
          issues.push(`Revenues table missing columns: ${revenuesMissingColumns.join(', ')}`);
        }
      } else {
        issues.push("Revenues table does not exist");
      }
      
      const allTablesExist = expensesTableExists?.exists && revenuesTableExists?.exists;
      const allColumnsExist = expensesMissingColumns.length === 0 && revenuesMissingColumns.length === 0;
      
      console.log("Schema check completed");
      console.log("Issues found:", issues);
      
      return {
        expenses: {
          tableExists: expensesTableExists?.exists || false,
          requiredColumns: requiredExpenseColumns,
          missingColumns: expensesMissingColumns,
          existingColumns: expensesExistingColumns
        },
        revenues: {
          tableExists: revenuesTableExists?.exists || false,
          requiredColumns: requiredRevenueColumns,
          missingColumns: revenuesMissingColumns,
          existingColumns: revenuesExistingColumns
        },
        summary: {
          allTablesExist,
          allColumnsExist,
          issues
        }
      };
      
    } catch (error) {
      console.error('Schema check error:', error);
      issues.push(`Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        expenses: {
          tableExists: false,
          requiredColumns: requiredExpenseColumns,
          missingColumns: requiredExpenseColumns,
          existingColumns: []
        },
        revenues: {
          tableExists: false,
          requiredColumns: requiredRevenueColumns,
          missingColumns: requiredRevenueColumns,
          existingColumns: []
        },
        summary: {
          allTablesExist: false,
          allColumnsExist: false,
          issues
        }
      };
    }
  }
);
