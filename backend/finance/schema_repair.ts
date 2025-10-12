import { financeDB } from "./db";
import { validateFinanceSchema, columnExists, constraintExists, indexExists } from "./schema_validation";

export interface SchemaRepairResult {
  success: boolean;
  message: string;
  results: string[];
  errors: string[];
  summary: {
    columns_added: number;
    constraints_added: number;
    indexes_added: number;
    total_operations: number;
  };
}

// Column definitions for safe addition
const COLUMN_DEFINITIONS = {
  revenues: [
    { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending\' NOT NULL' },
    { name: 'approved_by_user_id', type: 'INTEGER' },
    { name: 'approved_at', type: 'TIMESTAMP WITH TIME ZONE' },
    { name: 'payment_mode', type: 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))' },
    { name: 'bank_reference', type: 'VARCHAR(255)' },
    { name: 'receipt_file_id', type: 'INTEGER' }
  ],
  expenses: [
    { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending\' NOT NULL' },
    { name: 'approved_by_user_id', type: 'INTEGER' },
    { name: 'approved_at', type: 'TIMESTAMP WITH TIME ZONE' },
    { name: 'payment_mode', type: 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))' },
    { name: 'bank_reference', type: 'VARCHAR(255)' },
    { name: 'receipt_file_id', type: 'INTEGER' }
  ]
};

// Foreign key constraint definitions
const CONSTRAINT_DEFINITIONS = {
  revenues: [
    { name: 'fk_revenues_approved_by_user_id', definition: 'FOREIGN KEY (approved_by_user_id) REFERENCES users(id)' },
    { name: 'fk_revenues_receipt_file_id', definition: 'FOREIGN KEY (receipt_file_id) REFERENCES files(id)' }
  ],
  expenses: [
    { name: 'fk_expenses_approved_by_user_id', definition: 'FOREIGN KEY (approved_by_user_id) REFERENCES users(id)' },
    { name: 'fk_expenses_receipt_file_id', definition: 'FOREIGN KEY (receipt_file_id) REFERENCES files(id)' }
  ]
};

// Index definitions
const INDEX_DEFINITIONS = {
  revenues: [
    { name: 'idx_revenues_status', definition: 'ON revenues(org_id, status)' },
    { name: 'idx_revenues_payment_mode', definition: 'ON revenues(org_id, payment_mode)' },
    { name: 'idx_revenues_approved_by', definition: 'ON revenues(approved_by_user_id)' }
  ],
  expenses: [
    { name: 'idx_expenses_status', definition: 'ON expenses(org_id, status)' },
    { name: 'idx_expenses_payment_mode', definition: 'ON expenses(org_id, payment_mode)' },
    { name: 'idx_expenses_approved_by', definition: 'ON expenses(approved_by_user_id)' }
  ]
};

/**
 * Add a column to a table safely (only if it doesn't exist)
 * Note: This function is disabled due to Encore's static SQL requirements.
 * Schema changes should be performed using database migration tools.
 */
export async function addColumnSafely(tableName: string, columnName: string, columnType: string): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: `Schema modification not available through API. Please use database migration tools to add column ${columnName} to ${tableName} table. SQL: ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnType};`
  };
}

/**
 * Add a foreign key constraint safely (only if it doesn't exist)
 * Note: This function is disabled due to Encore's static SQL requirements.
 * Schema changes should be performed using database migration tools.
 */
export async function addConstraintSafely(tableName: string, constraintName: string, constraintDefinition: string): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: `Schema modification not available through API. Please use database migration tools to add constraint ${constraintName} to ${tableName} table. SQL: ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${constraintDefinition};`
  };
}

/**
 * Add an index safely (only if it doesn't exist)
 * Note: This function is disabled due to Encore's static SQL requirements.
 * Schema changes should be performed using database migration tools.
 */
export async function addIndexSafely(tableName: string, indexName: string, indexDefinition: string): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: `Schema modification not available through API. Please use database migration tools to add index ${indexName} for ${tableName} table. SQL: CREATE INDEX IF NOT EXISTS ${indexName} ${indexDefinition};`
  };
}

/**
 * Repair schema for a specific table
 */
export async function repairTableSchema(tableName: string): Promise<{ results: string[]; errors: string[]; summary: { columns_added: number; constraints_added: number; indexes_added: number } }> {
  const results: string[] = [];
  const errors: string[] = [];
  let columnsAdded = 0;
  let constraintsAdded = 0;
  let indexesAdded = 0;

  try {
    console.log(`Starting schema repair for table: ${tableName}`);

    // Add missing columns
    const columns = COLUMN_DEFINITIONS[tableName as keyof typeof COLUMN_DEFINITIONS] || [];
    for (const column of columns) {
      const result = await addColumnSafely(tableName, column.name, column.type);
      if (result.success) {
        results.push(result.message);
        if (result.message.includes('Added column')) {
          columnsAdded++;
        }
      } else {
        errors.push(result.message);
      }
    }

    // Add missing constraints
    const constraints = CONSTRAINT_DEFINITIONS[tableName as keyof typeof CONSTRAINT_DEFINITIONS] || [];
    for (const constraint of constraints) {
      const result = await addConstraintSafely(tableName, constraint.name, constraint.definition);
      if (result.success) {
        results.push(result.message);
        if (result.message.includes('Added constraint')) {
          constraintsAdded++;
        }
      } else {
        errors.push(result.message);
      }
    }

    // Add missing indexes
    const indexes = INDEX_DEFINITIONS[tableName as keyof typeof INDEX_DEFINITIONS] || [];
    for (const index of indexes) {
      const result = await addIndexSafely(tableName, index.name, index.definition);
      if (result.success) {
        results.push(result.message);
        if (result.message.includes('Added index')) {
          indexesAdded++;
        }
      } else {
        errors.push(result.message);
      }
    }

    console.log(`Schema repair completed for ${tableName}:`, {
      columnsAdded,
      constraintsAdded,
      indexesAdded,
      resultsCount: results.length,
      errorsCount: errors.length
    });

    return {
      results,
      errors,
      summary: {
        columns_added: columnsAdded,
        constraints_added: constraintsAdded,
        indexes_added: indexesAdded
      }
    };
  } catch (error) {
    const errorMessage = `Schema repair failed for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage, error);
    errors.push(errorMessage);
    
    return {
      results,
      errors,
      summary: {
        columns_added: columnsAdded,
        constraints_added: constraintsAdded,
        indexes_added: indexesAdded
      }
    };
  }
}

/**
 * Repair schema for both revenues and expenses tables
 */
export async function repairFinanceSchema(): Promise<SchemaRepairResult> {
  try {
    console.log('Starting comprehensive finance schema repair...');

    // Repair both tables in parallel
    const [revenuesResult, expensesResult] = await Promise.all([
      repairTableSchema('revenues'),
      repairTableSchema('expenses')
    ]);

    // Combine results
    const allResults = [...revenuesResult.results, ...expensesResult.results];
    const allErrors = [...revenuesResult.errors, ...expensesResult.errors];
    
    const totalColumnsAdded = revenuesResult.summary.columns_added + expensesResult.summary.columns_added;
    const totalConstraintsAdded = revenuesResult.summary.constraints_added + expensesResult.summary.constraints_added;
    const totalIndexesAdded = revenuesResult.summary.indexes_added + expensesResult.summary.indexes_added;
    const totalOperations = totalColumnsAdded + totalConstraintsAdded + totalIndexesAdded;

    const success = allErrors.length === 0;
    const message = success 
      ? `Schema repair completed successfully. Added ${totalColumnsAdded} columns, ${totalConstraintsAdded} constraints, and ${totalIndexesAdded} indexes.`
      : `Schema repair completed with ${allErrors.length} errors. Added ${totalColumnsAdded} columns, ${totalConstraintsAdded} constraints, and ${totalIndexesAdded} indexes.`;

    console.log('Finance schema repair completed:', {
      success,
      totalOperations,
      totalColumnsAdded,
      totalConstraintsAdded,
      totalIndexesAdded,
      errorsCount: allErrors.length
    });

    return {
      success,
      message,
      results: allResults,
      errors: allErrors,
      summary: {
        columns_added: totalColumnsAdded,
        constraints_added: totalConstraintsAdded,
        indexes_added: totalIndexesAdded,
        total_operations: totalOperations
      }
    };
  } catch (error) {
    const errorMessage = `Finance schema repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage, error);
    
    return {
      success: false,
      message: errorMessage,
      results: [],
      errors: [errorMessage],
      summary: {
        columns_added: 0,
        constraints_added: 0,
        indexes_added: 0,
        total_operations: 0
      }
    };
  }
}

/**
 * Update existing records with default values for new columns
 */
export async function updateDefaultValues(): Promise<{ success: boolean; message: string; results: string[] }> {
  const results: string[] = [];
  
  try {
    console.log('Updating default values for existing records...');

    // Update revenues table
    try {
      await financeDB.exec`
        UPDATE revenues 
        SET status = 'pending', payment_mode = 'cash' 
        WHERE status IS NULL OR payment_mode IS NULL
      `;
      results.push('✓ Updated existing revenues with default values');
    } catch (error: any) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        results.push('Note: Could not update revenues - columns do not exist yet');
      } else {
        results.push(`Note: Could not update existing revenues: ${error.message}`);
      }
    }

    // Update expenses table
    try {
      await financeDB.exec`
        UPDATE expenses 
        SET status = 'pending', payment_mode = 'cash' 
        WHERE status IS NULL OR payment_mode IS NULL
      `;
      results.push('✓ Updated existing expenses with default values');
    } catch (error: any) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        results.push('Note: Could not update expenses - columns do not exist yet');
      } else {
        results.push(`Note: Could not update existing expenses: ${error.message}`);
      }
    }

    return {
      success: true,
      message: 'Default value updates completed',
      results
    };
  } catch (error) {
    const errorMessage = `Failed to update default values: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage, error);
    
    return {
      success: false,
      message: errorMessage,
      results
    };
  }
}

/**
 * Complete schema repair with validation
 */
export async function completeSchemaRepair(): Promise<SchemaRepairResult> {
  try {
    console.log('Starting complete schema repair with validation...');

    // First, repair the schema
    const repairResult = await repairFinanceSchema();
    
    // Then, update default values
    const defaultValuesResult = await updateDefaultValues();
    
    // Combine results
    const allResults = [...repairResult.results, ...defaultValuesResult.results];
    const allErrors = [...repairResult.errors];
    
    if (!defaultValuesResult.success) {
      allErrors.push(defaultValuesResult.message);
    }

    // Finally, validate the schema
    const validationResult = await validateFinanceSchema();
    
    const success = repairResult.success && defaultValuesResult.success && validationResult.success;
    const message = success 
      ? `Complete schema repair successful. Schema is now ${validationResult.overall_status}.`
      : `Schema repair completed with issues. Check errors for details.`;

    return {
      success,
      message,
      results: allResults,
      errors: allErrors,
      summary: repairResult.summary
    };
  } catch (error) {
    const errorMessage = `Complete schema repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage, error);
    
    return {
      success: false,
      message: errorMessage,
      results: [],
      errors: [errorMessage],
      summary: {
        columns_added: 0,
        constraints_added: 0,
        indexes_added: 0,
        total_operations: 0
      }
    };
  }
}
