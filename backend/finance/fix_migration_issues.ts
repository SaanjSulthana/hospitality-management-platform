import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";

export interface FixMigrationRequest {
  reset?: boolean;
}

export interface FixMigrationResponse {
  success: boolean;
  message: string;
  details?: any;
}

// Admin endpoint to fix finance migration issues
export const fixMigrationIssues = api<FixMigrationRequest, FixMigrationResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/fix-migration-issues" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    try {
      console.log(`Admin ${authData.userID} (org ${authData.orgId}) fixing finance migration issues...`);
      
      const { reset = false } = req;
      
      if (reset) {
        console.log("Resetting migration state...");
        await resetMigrationState();
      }
      
      // Ensure base tables exist
      await ensureBaseTables();
      
      // Run pending migrations
      await runPendingMigrations();
      
      return {
        success: true,
        message: "Finance migration issues fixed successfully",
        details: {
          reset,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Fix migration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw APIError.internal(`Failed to fix migration issues: ${errorMessage}`);
    }
  }
);

async function resetMigrationState() {
  console.log("Clearing migration state...");
  
  // Drop tables in correct order to handle foreign key constraints
  const dropStatements = [
    'DROP TABLE IF EXISTS revenue_deletion_requests CASCADE',
    'DROP TABLE IF EXISTS expense_deletion_requests CASCADE', 
    'DROP TABLE IF EXISTS daily_cash_balances CASCADE',
    'DROP TABLE IF EXISTS daily_approvals CASCADE',
    'DROP TABLE IF EXISTS files CASCADE',
    'DROP TABLE IF EXISTS expenses CASCADE',
    'DROP TABLE IF EXISTS revenues CASCADE'
  ];
  
  for (const statement of dropStatements) {
    try {
      await financeDB.exec(statement);
      console.log(`Executed: ${statement}`);
    } catch (error) {
      console.log(`Skipped (table may not exist): ${statement}`);
    }
  }
  
  // Clear migration tracking
  try {
    await financeDB.exec(`
      DELETE FROM schema_migrations 
      WHERE version IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')
    `);
    console.log("Cleared migration tracking table");
  } catch (error) {
    console.log("Migration tracking table may not exist yet");
  }
}

async function ensureBaseTables() {
  console.log("Ensuring base tables exist...");
  
  // Create revenues table
  await financeDB.exec(`
    CREATE TABLE IF NOT EXISTS revenues (
        id BIGSERIAL PRIMARY KEY,
        org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('room', 'addon', 'other')),
        amount_cents BIGINT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        description TEXT,
        receipt_url TEXT,
        occurred_at TIMESTAMPTZ NOT NULL,
        created_by_user_id BIGINT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        meta_json JSONB DEFAULT '{}'
    )
  `);
  
  // Create expenses table
  await financeDB.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
        id BIGSERIAL PRIMARY KEY,
        org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        amount_cents BIGINT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        description TEXT,
        receipt_url TEXT,
        occurred_at TIMESTAMPTZ NOT NULL,
        created_by_user_id BIGINT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        meta_json JSONB DEFAULT '{}'
    )
  `);
  
  console.log("Base tables ensured");
}

async function runPendingMigrations() {
  console.log("Running pending migrations...");
  
  // Migration 1: Create indexes for base tables
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_revenues_org_id ON revenues(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_revenues_property_id ON revenues(property_id)',
    'CREATE INDEX IF NOT EXISTS idx_revenues_occurred_at ON revenues(occurred_at)',
    'CREATE INDEX IF NOT EXISTS idx_revenues_source ON revenues(source)',
    'CREATE INDEX IF NOT EXISTS idx_revenues_created_by_user_id ON revenues(created_by_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON expenses(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_property_id ON expenses(property_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_occurred_at ON expenses(occurred_at)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_created_by_user_id ON expenses(created_by_user_id)'
  ];
  
  for (const index of indexes) {
    try {
      await financeDB.exec(index);
      console.log(`Created index: ${index}`);
    } catch (error) {
      console.log(`Index may already exist: ${index}`);
    }
  }
  
  // Add missing columns from migrations
  await addMissingColumns();
  
  console.log("Pending migrations completed");
}

async function addMissingColumns() {
  console.log("Adding missing columns...");
  
  // Add receipt_file_id columns
  await addColumnIfNotExists('revenues', 'receipt_file_id', 'INTEGER');
  await addColumnIfNotExists('expenses', 'receipt_file_id', 'INTEGER');
  
  // Add status and approval columns to revenues
  await addColumnIfNotExists('revenues', 'status', 'VARCHAR(20) DEFAULT \'pending\' NOT NULL');
  await addColumnIfNotExists('revenues', 'approved_by_user_id', 'INTEGER');
  await addColumnIfNotExists('revenues', 'approved_at', 'TIMESTAMP');
  
  // Add payment mode columns
  await addColumnIfNotExists('revenues', 'payment_mode', 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))');
  await addColumnIfNotExists('revenues', 'bank_reference', 'VARCHAR(255)');
  await addColumnIfNotExists('expenses', 'payment_mode', 'VARCHAR(10) DEFAULT \'cash\' NOT NULL CHECK (payment_mode IN (\'cash\', \'bank\'))');
  await addColumnIfNotExists('expenses', 'bank_reference', 'VARCHAR(255)');
  
  console.log("Missing columns added");
}

async function addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string) {
  const exists = await financeDB.queryRow`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `;
  
  if (!exists) {
    await financeDB.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    console.log(`Added column ${columnName} to ${tableName}`);
  } else {
    console.log(`Column ${columnName} already exists in ${tableName}`);
  }
}
