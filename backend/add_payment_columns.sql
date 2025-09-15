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

