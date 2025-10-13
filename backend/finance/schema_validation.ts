import { financeDB } from "./db";

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

export interface IndexInfo {
  indexname: string;
  indexdef: string;
}

export interface SchemaValidationResult {
  table: string;
  missing_columns: string[];
  existing_columns: string[];
  missing_constraints: string[];
  existing_constraints: string[];
  missing_indexes: string[];
  existing_indexes: string[];
  is_complete: boolean;
}

export interface SchemaStatusResponse {
  success: boolean;
  message: string;
  revenues: SchemaValidationResult;
  expenses: SchemaValidationResult;
  overall_status: 'complete' | 'incomplete' | 'error';
}

// Required columns for each table
const REQUIRED_COLUMNS = {
  revenues: [
    'status', 'approved_by_user_id', 'approved_at', 
    'payment_mode', 'bank_reference', 'receipt_file_id'
  ],
  expenses: [
    'status', 'approved_by_user_id', 'approved_at', 
    'payment_mode', 'bank_reference', 'receipt_file_id'
  ]
};

// Required foreign key constraints
const REQUIRED_CONSTRAINTS = {
  revenues: [
    'fk_revenues_approved_by_user_id',
    'fk_revenues_receipt_file_id'
  ],
  expenses: [
    'fk_expenses_approved_by_user_id',
    'fk_expenses_receipt_file_id'
  ]
};

// Required performance indexes
const REQUIRED_INDEXES = {
  revenues: [
    'idx_revenues_status',
    'idx_revenues_payment_mode',
    'idx_revenues_approved_by'
  ],
  expenses: [
    'idx_expenses_status',
    'idx_expenses_payment_mode',
    'idx_expenses_approved_by'
  ]
};

/**
 * Get all columns for a specific table
 */
export async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  try {
    const columns = await financeDB.queryAll`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = ${tableName} AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    return columns as ColumnInfo[];
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error);
    throw new Error(`Failed to get columns for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all foreign key constraints for a specific table
 */
export async function getTableConstraints(tableName: string): Promise<ConstraintInfo[]> {
  try {
    const constraints = await financeDB.queryAll`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = ${tableName} AND constraint_type = 'FOREIGN KEY'
    `;
    return constraints as ConstraintInfo[];
  } catch (error) {
    console.error(`Error getting constraints for table ${tableName}:`, error);
    throw new Error(`Failed to get constraints for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all indexes for a specific table
 */
export async function getTableIndexes(tableName: string): Promise<IndexInfo[]> {
  try {
    const indexes = await financeDB.queryAll`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = ${tableName} AND schemaname = 'public'
    `;
    return indexes as IndexInfo[];
  } catch (error) {
    console.error(`Error getting indexes for table ${tableName}:`, error);
    throw new Error(`Failed to get indexes for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate schema for a specific table
 */
export async function validateTableSchema(tableName: string): Promise<SchemaValidationResult> {
  try {
    console.log(`Validating schema for table: ${tableName}`);

    // Get current schema information
    const [columns, constraints, indexes] = await Promise.all([
      getTableColumns(tableName),
      getTableConstraints(tableName),
      getTableIndexes(tableName)
    ]);

    // Extract names for comparison
    const existingColumnNames = columns.map(col => col.column_name);
    const existingConstraintNames = constraints.map(constraint => constraint.constraint_name);
    const existingIndexNames = indexes.map(index => index.indexname);

    // Find missing elements
    const missingColumns = REQUIRED_COLUMNS[tableName as keyof typeof REQUIRED_COLUMNS]?.filter(
      col => !existingColumnNames.includes(col)
    ) || [];

    const missingConstraints = REQUIRED_CONSTRAINTS[tableName as keyof typeof REQUIRED_CONSTRAINTS]?.filter(
      constraint => !existingConstraintNames.includes(constraint)
    ) || [];

    const missingIndexes = REQUIRED_INDEXES[tableName as keyof typeof REQUIRED_INDEXES]?.filter(
      index => !existingIndexNames.includes(index)
    ) || [];

    const isComplete = missingColumns.length === 0 && missingConstraints.length === 0 && missingIndexes.length === 0;

    console.log(`Schema validation for ${tableName}:`, {
      missingColumns,
      missingConstraints,
      missingIndexes,
      isComplete
    });

    return {
      table: tableName,
      missing_columns: missingColumns,
      existing_columns: existingColumnNames,
      missing_constraints: missingConstraints,
      existing_constraints: existingConstraintNames,
      missing_indexes: missingIndexes,
      existing_indexes: existingIndexNames,
      is_complete: isComplete
    };
  } catch (error) {
    console.error(`Error validating schema for table ${tableName}:`, error);
    throw new Error(`Schema validation failed for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate schema for both revenues and expenses tables
 */
export async function validateFinanceSchema(): Promise<SchemaStatusResponse> {
  try {
    console.log('Starting comprehensive finance schema validation...');

    // Validate both tables in parallel
    const [revenuesResult, expensesResult] = await Promise.all([
      validateTableSchema('revenues'),
      validateTableSchema('expenses')
    ]);

    // Determine overall status
    const overallStatus = (revenuesResult.is_complete && expensesResult.is_complete) 
      ? 'complete' 
      : 'incomplete';

    const message = overallStatus === 'complete' 
      ? 'Schema validation completed successfully - all required columns, constraints, and indexes are present'
      : 'Schema validation completed with issues - some columns, constraints, or indexes are missing';

    console.log('Finance schema validation completed:', {
      overallStatus,
      revenuesComplete: revenuesResult.is_complete,
      expensesComplete: expensesResult.is_complete
    });

    return {
      success: true,
      message,
      revenues: revenuesResult,
      expenses: expensesResult,
      overall_status: overallStatus
    };
  } catch (error) {
    console.error('Error during finance schema validation:', error);
    return {
      success: false,
      message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      revenues: {
        table: 'revenues',
        missing_columns: [],
        existing_columns: [],
        missing_constraints: [],
        existing_constraints: [],
        missing_indexes: [],
        existing_indexes: [],
        is_complete: false
      },
      expenses: {
        table: 'expenses',
        missing_columns: [],
        existing_columns: [],
        missing_constraints: [],
        existing_constraints: [],
        missing_indexes: [],
        existing_indexes: [],
        is_complete: false
      },
      overall_status: 'error'
    };
  }
}

/**
 * Check if a specific column exists in a table
 */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await financeDB.queryRow`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName} AND column_name = ${columnName} AND table_schema = 'public'
    `;
    return !!result;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in table ${tableName}:`, error);
    return false;
  }
}

/**
 * Check if a specific constraint exists in a table
 */
export async function constraintExists(tableName: string, constraintName: string): Promise<boolean> {
  try {
    const result = await financeDB.queryRow`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = ${tableName} AND constraint_name = ${constraintName} AND constraint_type = 'FOREIGN KEY'
    `;
    return !!result;
  } catch (error) {
    console.error(`Error checking if constraint ${constraintName} exists in table ${tableName}:`, error);
    return false;
  }
}

/**
 * Check if a specific index exists
 */
export async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  try {
    const result = await financeDB.queryRow`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = ${tableName} AND indexname = ${indexName} AND schemaname = 'public'
    `;
    return !!result;
  } catch (error) {
    console.error(`Error checking if index ${indexName} exists for table ${tableName}:`, error);
    return false;
  }
}

/**
 * Get detailed schema information for debugging
 */
export async function getDetailedSchemaInfo(tableName: string): Promise<{
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
}> {
  try {
    const [columns, constraints, indexes] = await Promise.all([
      getTableColumns(tableName),
      getTableConstraints(tableName),
      getTableIndexes(tableName)
    ]);

    return {
      columns,
      constraints,
      indexes
    };
  } catch (error) {
    console.error(`Error getting detailed schema info for table ${tableName}:`, error);
    throw new Error(`Failed to get detailed schema info for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
