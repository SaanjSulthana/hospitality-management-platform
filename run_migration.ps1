# PowerShell script to run the payment mode migration
# This script connects to the database and runs the migration SQL

Write-Host "=== RUNNING PAYMENT MODE MIGRATION ===" -ForegroundColor Green

# Database connection parameters (adjust as needed)
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "encore"
$dbUser = "encore"

Write-Host "Connecting to database: $dbName on ${dbHost}:${dbPort}" -ForegroundColor Yellow

# SQL commands to run
$sqlCommands = @"
-- Add payment mode columns to revenues and expenses tables
-- This migration adds payment_mode and bank_reference columns

-- Add payment_mode to revenues table
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));

-- Add bank_reference to revenues table
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255);

-- Add payment_mode to expenses table  
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));

-- Add bank_reference to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(255);

-- Update existing records to have default payment_mode
UPDATE revenues SET payment_mode = 'cash' WHERE payment_mode IS NULL;
UPDATE expenses SET payment_mode = 'cash' WHERE payment_mode IS NULL;

-- Verify the columns were added
SELECT 'revenues' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'revenues' AND table_schema = 'public' AND column_name IN ('payment_mode', 'bank_reference')
UNION ALL
SELECT 'expenses' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'expenses' AND table_schema = 'public' AND column_name IN ('payment_mode', 'bank_reference')
ORDER BY table_name, column_name;
"@

Write-Host "SQL Commands to execute:" -ForegroundColor Cyan
Write-Host $sqlCommands -ForegroundColor Gray

Write-Host "`nTo run this migration manually:" -ForegroundColor Yellow
Write-Host "1. Connect to your PostgreSQL database" -ForegroundColor White
Write-Host "2. Run the SQL commands above" -ForegroundColor White
Write-Host "3. Or use psql command line:" -ForegroundColor White
Write-Host "   psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f add_payment_columns.sql" -ForegroundColor Cyan

Write-Host "`nAlternatively, you can run the migration via API once you have a valid token:" -ForegroundColor Yellow
Write-Host "POST http://localhost:4000/finance/run-migration-no-auth" -ForegroundColor Cyan

Write-Host "`n=== MIGRATION SCRIPT READY ===" -ForegroundColor Green
