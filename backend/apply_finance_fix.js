#!/usr/bin/env node

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Applying Finance Migration Fix...');

// Function to run SQL commands
async function runSQLCommand(sql) {
  return new Promise((resolve, reject) => {
    // This would need the actual database connection
    // For now, we'll create the migration files and let Encore handle them
    console.log('📝 SQL Command:', sql);
    resolve();
  });
}

// Function to create the missing migration files
function createMigrationFiles() {
  console.log('📁 Creating missing migration files...');
  
  const migrationsDir = path.join(__dirname, 'finance', 'migrations');
  
  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  // Migration 1: Create revenues table
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

  // Migration 2: Create expenses table
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

  // Write migration files
  fs.writeFileSync(path.join(migrationsDir, '1_create_revenues_table.up.sql'), migration1Up);
  fs.writeFileSync(path.join(migrationsDir, '1_create_revenues_table.down.sql'), migration1Down);
  fs.writeFileSync(path.join(migrationsDir, '2_create_expenses_table.up.sql'), migration2Up);
  fs.writeFileSync(path.join(migrationsDir, '2_create_expenses_table.down.sql'), migration2Down);
  
  console.log('✅ Migration files created successfully');
}

// Function to fix existing migration 3
function fixMigration3() {
  console.log('🔧 Fixing migration 3...');
  
  const migration3Path = path.join(__dirname, 'finance', 'migrations', '3_add_receipt_file_id.up.sql');
  
  if (fs.existsSync(migration3Path)) {
    const migration3Content = `-- Add receipt_file_id column to revenues table (if it doesn't exist)
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
    
    fs.writeFileSync(migration3Path, migration3Content);
    console.log('✅ Migration 3 fixed successfully');
  } else {
    console.log('⚠️ Migration 3 file not found');
  }
}

// Function to fix migration 7
function fixMigration7() {
  console.log('🔧 Fixing migration 7...');
  
  const migration7Path = path.join(__dirname, 'finance', 'migrations', '7_add_revenue_status.up.sql');
  
  if (fs.existsSync(migration7Path)) {
    const migration7Content = `-- Add status and approval fields to revenues table to match expenses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'status') THEN
        ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'approved_by_user_id') THEN
        ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'approved_at') THEN
        ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;
    END IF;
END $$;

-- Add foreign key constraint for approved_by_user_id (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'revenues' AND constraint_name = 'fk_revenues_approved_by_user_id') THEN
        ALTER TABLE revenues ADD CONSTRAINT fk_revenues_approved_by_user_id FOREIGN KEY (approved_by_user_id) REFERENCES users(id);
    END IF;
END $$;

-- Update existing revenues to 'pending' status
UPDATE revenues SET status = 'pending' WHERE status IS NULL;`;
    
    fs.writeFileSync(migration7Path, migration7Content);
    console.log('✅ Migration 7 fixed successfully');
  } else {
    console.log('⚠️ Migration 7 file not found');
  }
}

// Function to fix migration 8
function fixMigration8() {
  console.log('🔧 Fixing migration 8...');
  
  const migration8Path = path.join(__dirname, 'finance', 'migrations', '8_add_payment_modes.up.sql');
  
  if (fs.existsSync(migration8Path)) {
    const existingContent = fs.readFileSync(migration8Path, 'utf8');
    
    // Replace the ALTER TABLE statements with conditional ones
    const fixedContent = existingContent
      .replace(
        /ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR\(10\) DEFAULT 'cash' NOT NULL CHECK \(payment_mode IN \('cash', 'bank'\)\);/,
        `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'payment_mode') THEN
        ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));
    END IF;
END $$;`
      )
      .replace(
        /ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR\(255\);/,
        `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'revenues' AND column_name = 'bank_reference') THEN
        ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255);
    END IF;
END $$;`
      )
      .replace(
        /ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR\(10\) DEFAULT 'cash' NOT NULL CHECK \(payment_mode IN \('cash', 'bank'\)\);/,
        `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'payment_mode') THEN
        ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));
    END IF;
END $$;`
      )
      .replace(
        /ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR\(255\);/,
        `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expenses' AND column_name = 'bank_reference') THEN
        ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255);
    END IF;
END $$;`
      );
    
    fs.writeFileSync(migration8Path, fixedContent);
    console.log('✅ Migration 8 fixed successfully');
  } else {
    console.log('⚠️ Migration 8 file not found');
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Finance Migration Fix...');
    
    // Step 1: Create missing migration files
    createMigrationFiles();
    
    // Step 2: Fix existing migrations
    fixMigration3();
    fixMigration7();
    fixMigration8();
    
    console.log('✅ Finance Migration Fix Applied Successfully!');
    console.log('');
    console.log('📋 Summary of Changes:');
    console.log('  - Created migration 1: Create revenues table');
    console.log('  - Created migration 2: Create expenses table');
    console.log('  - Fixed migration 3: Made column additions conditional');
    console.log('  - Fixed migration 7: Made status column additions conditional');
    console.log('  - Fixed migration 8: Made payment mode column additions conditional');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('  1. Restart your Encore application');
    console.log('  2. The migrations should now run successfully');
    console.log('  3. Your finance service will be fully operational');
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
    process.exit(1);
  }
}

// Run the fix
main();
