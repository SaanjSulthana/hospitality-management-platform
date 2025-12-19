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
      message: "Schema check complete. Set confirmFix=true and run migrations manually via Encore Cloud console.",
      fixes,
      errors,
      currentSchema: {
        revenues: revenueColumns,
        expenses: expenseColumns
      }
    };
  }
  
  // Since Encore doesn't support dynamic DDL, provide SQL to run manually
  const sqlToRun: string[] = [];
  
  if (missingRevenueColumns.includes('created_by_user_id')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;');
  }
  if (missingRevenueColumns.includes('source')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS source TEXT;');
  }
  if (missingRevenueColumns.includes('currency')) {
    sqlToRun.push("ALTER TABLE revenues ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';");
  }
  if (missingRevenueColumns.includes('description')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS description TEXT;');
  }
  if (missingRevenueColumns.includes('receipt_url')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_url TEXT;');
  }
  if (missingRevenueColumns.includes('meta_json')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS meta_json JSONB;');
  }
  if (missingRevenueColumns.includes('receipt_file_id')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;');
  }
  if (missingRevenueColumns.includes('status')) {
    sqlToRun.push("ALTER TABLE revenues ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
  }
  if (missingRevenueColumns.includes('approved_by_user_id')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;');
  }
  if (missingRevenueColumns.includes('approved_at')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;');
  }
  if (missingRevenueColumns.includes('payment_mode')) {
    sqlToRun.push("ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';");
  }
  if (missingRevenueColumns.includes('bank_reference')) {
    sqlToRun.push('ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);');
  }
  
  if (missingExpenseColumns.includes('created_by_user_id')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;');
  }
  if (missingExpenseColumns.includes('currency')) {
    sqlToRun.push("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';");
  }
  if (missingExpenseColumns.includes('description')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;');
  }
  if (missingExpenseColumns.includes('receipt_url')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;');
  }
  if (missingExpenseColumns.includes('receipt_file_id')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;');
  }
  if (missingExpenseColumns.includes('status')) {
    sqlToRun.push("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';");
  }
  if (missingExpenseColumns.includes('approved_by_user_id')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;');
  }
  if (missingExpenseColumns.includes('approved_at')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;');
  }
  if (missingExpenseColumns.includes('payment_mode')) {
    sqlToRun.push("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';");
  }
  if (missingExpenseColumns.includes('bank_reference')) {
    sqlToRun.push('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);');
  }
  
  return {
    success: sqlToRun.length === 0,
    message: sqlToRun.length === 0 
      ? "Schema is already complete!" 
      : `Run these SQL statements in Encore Cloud > Database > hospitality > SQL Console:\n\n${sqlToRun.join('\n')}`,
    fixes,
    errors: sqlToRun.length > 0 ? [`${sqlToRun.length} ALTER TABLE statements needed`] : [],
    currentSchema: {
      revenues: revenueColumns,
      expenses: expenseColumns
    }
  };
}

// Expose the endpoint
export const fixStagingSchema = api<FixSchemaRequest, FixSchemaResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/fix-staging-schema" },
  fixStagingSchemaHandler
);
