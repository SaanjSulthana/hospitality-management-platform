import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

interface FixSchemaRequest {
  confirmFix?: boolean;
}

interface FixSchemaResponse {
  success: boolean;
  message: string;
  fixes: string[];
  errors: string[];
  currentSchema: {
    revenues: string[];
    expenses: string[];
  };
}

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await financeDB.queryAll`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName} 
        AND column_name = ${columnName}
    `;
    return result.length > 0;
  } catch (error) {
    console.error(`Error checking column ${columnName} in ${tableName}:`, error);
    return false;
  }
}

async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const result = await financeDB.queryAll`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    return result.map((r: any) => r.column_name);
  } catch (error) {
    console.error(`Error getting columns for ${tableName}:`, error);
    return [];
  }
}

async function fixStagingSchemaHandler(req: FixSchemaRequest): Promise<FixSchemaResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  
  // Only allow ADMIN users
  if (authData.role !== 'ADMIN') {
    throw APIError.permissionDenied("Only ADMIN users can fix schema");
  }
  
  const fixes: string[] = [];
  const errors: string[] = [];
  
  // Get current schema
  const revenueColumns = await getTableColumns('revenues');
  const expenseColumns = await getTableColumns('expenses');
  
  // Define expected columns
  const expectedRevenueColumns = [
    'created_by_user_id', 'source', 'currency', 'description', 'receipt_url',
    'meta_json', 'receipt_file_id', 'status', 'approved_by_user_id', 
    'approved_at', 'payment_mode', 'bank_reference'
  ];
  
  const expectedExpenseColumns = [
    'created_by_user_id', 'currency', 'description', 'receipt_url',
    'receipt_file_id', 'status', 'approved_by_user_id', 
    'approved_at', 'payment_mode', 'bank_reference'
  ];
  
  // Check which columns are missing
  const missingRevenueColumns = expectedRevenueColumns.filter(col => !revenueColumns.includes(col));
  const missingExpenseColumns = expectedExpenseColumns.filter(col => !expenseColumns.includes(col));
  
  if (missingRevenueColumns.length > 0) {
    errors.push(`Missing revenue columns: ${missingRevenueColumns.join(', ')}`);
  } else {
    fixes.push('All revenue columns present');
  }
  
  if (missingExpenseColumns.length > 0) {
    errors.push(`Missing expense columns: ${missingExpenseColumns.join(', ')}`);
  } else {
    fixes.push('All expense columns present');
  }
  
  if (!req.confirmFix) {
    return {
      success: missingRevenueColumns.length === 0 && missingExpenseColumns.length === 0,
      message: "Schema check complete. Set confirmFix=true to apply the migration programmatically.",
      fixes,
      errors,
      currentSchema: {
        revenues: revenueColumns,
        expenses: expenseColumns
      }
    };
  }

  // Execute migration programmatically
  const tx = await financeDB.begin();
  const appliedFixes: string[] = [];
  const migrationErrors: string[] = [];
  
  try {
    console.log("Starting staging schema migration...");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'finance/fix_staging_schema.ts:110',message:'Starting migration execution',data:{missingRevenueColumns,missingExpenseColumns},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Helper function to safely add column (uses transaction)
    const addColumnIfMissing = async (tableName: string, columnName: string, columnDef: string): Promise<boolean> => {
      const result = await tx.queryAll`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${tableName} 
          AND column_name = ${columnName}
      `;
      const exists = result.length > 0;
      if (!exists) {
        await tx.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        return true;
      }
      return false;
    };

    // Add missing columns to revenues table
    if (missingRevenueColumns.includes('description')) {
      if (await addColumnIfMissing('revenues', 'description', 'TEXT')) {
        appliedFixes.push('Added description column to revenues');
      }
    }
    if (missingRevenueColumns.includes('created_by_user_id')) {
      if (await addColumnIfMissing('revenues', 'created_by_user_id', 'BIGINT')) {
        appliedFixes.push('Added created_by_user_id column to revenues');
      }
    }
    if (missingRevenueColumns.includes('source')) {
      if (await addColumnIfMissing('revenues', 'source', 'TEXT')) {
        appliedFixes.push('Added source column to revenues');
      }
    }
    if (missingRevenueColumns.includes('currency')) {
      if (await addColumnIfMissing('revenues', 'currency', "TEXT DEFAULT 'INR'")) {
        appliedFixes.push('Added currency column to revenues');
      }
    }
    if (missingRevenueColumns.includes('receipt_url')) {
      if (await addColumnIfMissing('revenues', 'receipt_url', 'TEXT')) {
        appliedFixes.push('Added receipt_url column to revenues');
      }
    }
    if (missingRevenueColumns.includes('receipt_file_id')) {
      if (await addColumnIfMissing('revenues', 'receipt_file_id', 'INTEGER')) {
        appliedFixes.push('Added receipt_file_id column to revenues');
      }
    }
    if (missingRevenueColumns.includes('status')) {
      if (await addColumnIfMissing('revenues', 'status', "VARCHAR(50) DEFAULT 'pending'")) {
        appliedFixes.push('Added status column to revenues');
      }
    }
    if (missingRevenueColumns.includes('approved_by_user_id')) {
      if (await addColumnIfMissing('revenues', 'approved_by_user_id', 'INTEGER')) {
        appliedFixes.push('Added approved_by_user_id column to revenues');
      }
    }
    if (missingRevenueColumns.includes('approved_at')) {
      if (await addColumnIfMissing('revenues', 'approved_at', 'TIMESTAMP')) {
        appliedFixes.push('Added approved_at column to revenues');
      }
    }
    if (missingRevenueColumns.includes('payment_mode')) {
      if (await addColumnIfMissing('revenues', 'payment_mode', "VARCHAR(50) DEFAULT 'cash'")) {
        appliedFixes.push('Added payment_mode column to revenues');
      }
    }
    if (missingRevenueColumns.includes('bank_reference')) {
      if (await addColumnIfMissing('revenues', 'bank_reference', 'VARCHAR(100)')) {
        appliedFixes.push('Added bank_reference column to revenues');
      }
    }
    
    // Add missing columns to expenses table
    if (missingExpenseColumns.includes('description')) {
      if (await addColumnIfMissing('expenses', 'description', 'TEXT')) {
        appliedFixes.push('Added description column to expenses');
      }
    }
    if (missingExpenseColumns.includes('created_by_user_id')) {
      if (await addColumnIfMissing('expenses', 'created_by_user_id', 'BIGINT')) {
        appliedFixes.push('Added created_by_user_id column to expenses');
      }
    }
    if (missingExpenseColumns.includes('currency')) {
      if (await addColumnIfMissing('expenses', 'currency', "TEXT DEFAULT 'INR'")) {
        appliedFixes.push('Added currency column to expenses');
      }
    }
    if (missingExpenseColumns.includes('receipt_url')) {
      if (await addColumnIfMissing('expenses', 'receipt_url', 'TEXT')) {
        appliedFixes.push('Added receipt_url column to expenses');
      }
    }
    if (missingExpenseColumns.includes('receipt_file_id')) {
      if (await addColumnIfMissing('expenses', 'receipt_file_id', 'INTEGER')) {
        appliedFixes.push('Added receipt_file_id column to expenses');
      }
    }
    if (missingExpenseColumns.includes('status')) {
      if (await addColumnIfMissing('expenses', 'status', "VARCHAR(50) DEFAULT 'pending'")) {
        appliedFixes.push('Added status column to expenses');
      }
    }
    if (missingExpenseColumns.includes('approved_by_user_id')) {
      if (await addColumnIfMissing('expenses', 'approved_by_user_id', 'INTEGER')) {
        appliedFixes.push('Added approved_by_user_id column to expenses');
      }
    }
    if (missingExpenseColumns.includes('approved_at')) {
      if (await addColumnIfMissing('expenses', 'approved_at', 'TIMESTAMP')) {
        appliedFixes.push('Added approved_at column to expenses');
      }
    }
    if (missingExpenseColumns.includes('payment_mode')) {
      if (await addColumnIfMissing('expenses', 'payment_mode', "VARCHAR(50) DEFAULT 'cash'")) {
        appliedFixes.push('Added payment_mode column to expenses');
      }
    }
    if (missingExpenseColumns.includes('bank_reference')) {
      if (await addColumnIfMissing('expenses', 'bank_reference', 'VARCHAR(100)')) {
        appliedFixes.push('Added bank_reference column to expenses');
      }
    }
    
    // Update existing records with default status values
    if (missingRevenueColumns.includes('status') || missingExpenseColumns.includes('status')) {
      try {
        await tx.exec`UPDATE revenues SET status = 'pending' WHERE status IS NULL`;
        await tx.exec`UPDATE expenses SET status = 'pending' WHERE status IS NULL`;
        appliedFixes.push('Updated existing records with default status values');
      } catch (updateError) {
        console.warn('Warning: Could not update default status values:', updateError);
        // Non-critical, continue
      }
    }
    
    await tx.commit();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'finance/fix_staging_schema.ts:220',message:'Migration completed successfully',data:{appliedFixesCount:appliedFixes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    console.log("Staging schema migration completed successfully!");
    
    // Get updated schema
    const updatedRevenueColumns = await getTableColumns('revenues');
    const updatedExpenseColumns = await getTableColumns('expenses');
    
    return {
      success: true,
      message: appliedFixes.length > 0 
        ? `Migration completed successfully! Applied ${appliedFixes.length} fixes.`
        : "Schema is already complete - no changes needed.",
      fixes: [...fixes, ...appliedFixes],
      errors: migrationErrors.length > 0 ? migrationErrors : [],
      currentSchema: {
        revenues: updatedRevenueColumns,
        expenses: updatedExpenseColumns
      }
    };
  } catch (error) {
    await tx.rollback();
    console.error('Migration error:', error);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33d595d9-e296-4216-afc6-6fa72f7ee3e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'finance/fix_staging_schema.ts:240',message:'Migration failed',data:{errorMessage:(error as Error)?.message,errorName:(error as Error)?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    throw APIError.internal(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Expose the endpoint
export const fixStagingSchema = api<FixSchemaRequest, FixSchemaResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/fix-staging-schema" },
  fixStagingSchemaHandler
);
