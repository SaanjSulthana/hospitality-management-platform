#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Resetting Finance Migration State...');

// Function to reset migration state by clearing the database
function createResetScript() {
  const resetSQL = `-- Reset Finance Database Migration State
-- This script clears the migration state and prepares for a fresh migration run

-- Drop all finance-related tables in correct order (to handle foreign key constraints)
DROP TABLE IF EXISTS revenue_deletion_requests CASCADE;
DROP TABLE IF EXISTS expense_deletion_requests CASCADE;
DROP TABLE IF EXISTS daily_cash_balances CASCADE;
DROP TABLE IF EXISTS daily_approvals CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS revenues CASCADE;

-- Clear the migration tracking table for finance database
DELETE FROM schema_migrations WHERE version IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12');

-- Verify the cleanup
SELECT 'Finance database reset complete. Ready for fresh migration.' as status;`;

  const resetPath = path.join(__dirname, 'finance', 'reset_migration_state.sql');
  fs.writeFileSync(resetPath, resetSQL);
  console.log('✅ Reset SQL script created');
  return resetPath;
}

// Function to ensure migration files exist and are correct
function verifyMigrationFiles() {
  console.log('📁 Verifying migration files...');
  
  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  
  // Check if migrations 1 and 2 exist
  const migration1Up = path.join(migrationsDir, '1_create_revenues_table.up.sql');
  const migration2Up = path.join(migrationsDir, '2_create_expenses_table.up.sql');
  
  if (!fs.existsSync(migration1Up)) {
    console.log('❌ Migration 1 not found, creating...');
    createMigration1();
  } else {
    console.log('✅ Migration 1 exists');
  }
  
  if (!fs.existsSync(migration2Up)) {
    console.log('❌ Migration 2 not found, creating...');
    createMigration2();
  } else {
    console.log('✅ Migration 2 exists');
  }
  
  // Verify migration 3 is fixed
  const migration3Up = path.join(migrationsDir, '3_add_receipt_file_id.up.sql');
  if (fs.existsSync(migration3Up)) {
    const content = fs.readFileSync(migration3Up, 'utf8');
    if (content.includes('DO $$') && content.includes('IF NOT EXISTS')) {
      console.log('✅ Migration 3 is properly fixed');
    } else {
      console.log('⚠️ Migration 3 needs fixing, updating...');
      fixMigration3();
    }
  }
}

function createMigration1() {
  const migration1Up = `-- Create revenues table for tracking revenue transactions
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
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_revenues_org_id ON revenues(org_id);
CREATE INDEX IF NOT EXISTS idx_revenues_property_id ON revenues(property_id);
CREATE INDEX IF NOT EXISTS idx_revenues_occurred_at ON revenues(occurred_at);
CREATE INDEX IF NOT EXISTS idx_revenues_source ON revenues(source);
CREATE INDEX IF NOT EXISTS idx_revenues_created_by_user_id ON revenues(created_by_user_id);`;

  const migration1Down = `-- Drop revenues table and its indexes
DROP INDEX IF EXISTS idx_revenues_created_by_user_id;
DROP INDEX IF EXISTS idx_revenues_source;
DROP INDEX IF EXISTS idx_revenues_occurred_at;
DROP INDEX IF EXISTS idx_revenues_property_id;
DROP INDEX IF EXISTS idx_revenues_org_id;
DROP TABLE IF EXISTS revenues;`;

  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  fs.writeFileSync(path.join(migrationsDir, '1_create_revenues_table.up.sql'), migration1Up);
  fs.writeFileSync(path.join(migrationsDir, '1_create_revenues_table.down.sql'), migration1Down);
  console.log('✅ Migration 1 created');
}

function createMigration2() {
  const migration2Up = `-- Create expenses table for tracking expense transactions
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
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property_id ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_occurred_at ON expenses(occurred_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by_user_id ON expenses(created_by_user_id);`;

  const migration2Down = `-- Drop expenses table and its indexes
DROP INDEX IF EXISTS idx_expenses_created_by_user_id;
DROP INDEX IF EXISTS idx_expenses_category;
DROP INDEX IF EXISTS idx_expenses_occurred_at;
DROP INDEX IF EXISTS idx_expenses_property_id;
DROP INDEX IF EXISTS idx_expenses_org_id;
DROP TABLE IF EXISTS expenses;`;

  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  fs.writeFileSync(path.join(migrationsDir, '2_create_expenses_table.up.sql'), migration2Up);
  fs.writeFileSync(path.join(migrationsDir, '2_create_expenses_table.down.sql'), migration2Down);
  console.log('✅ Migration 2 created');
}

function fixMigration3() {
  const migration3Up = `-- Add receipt_file_id column to revenues table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'receipt_file_id') THEN
        ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;
    END IF;
END $$;

-- Add receipt_file_id column to expenses table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'receipt_file_id') THEN
        ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
    END IF;
END $$;`;

  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  fs.writeFileSync(path.join(migrationsDir, '3_add_receipt_file_id.up.sql'), migration3Up);
  console.log('✅ Migration 3 fixed');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Finance Migration Reset...');
    
    // Step 1: Create reset SQL script
    const resetScriptPath = createResetScript();
    
    // Step 2: Verify migration files
    verifyMigrationFiles();
    
    console.log('✅ Finance Migration Reset Complete!');
    console.log('');
    console.log('📋 Summary of Actions:');
    console.log('  - Created reset SQL script');
    console.log('  - Verified migration files 1 and 2 exist');
    console.log('  - Ensured migration 3 is properly fixed');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('  1. The reset script is ready at:', resetScriptPath);
    console.log('  2. Run the reset script manually if needed');
    console.log('  3. Start Encore with: npx encore run --watch');
    console.log('  4. Migrations should now run in correct order');
    
  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

// Run the reset
main();
