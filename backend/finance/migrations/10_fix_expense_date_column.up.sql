-- Fix expense_date column to use TIMESTAMPTZ instead of DATE
-- This will allow expenses to store full timestamps like revenues

-- First, add a new column with the correct type
ALTER TABLE expenses ADD COLUMN expense_date_new TIMESTAMPTZ;

-- Copy existing data, converting DATE to TIMESTAMPTZ (defaults to midnight)
UPDATE expenses SET expense_date_new = expense_date::TIMESTAMPTZ;

-- Make the new column NOT NULL
ALTER TABLE expenses ALTER COLUMN expense_date_new SET NOT NULL;

-- Drop the old column
ALTER TABLE expenses DROP COLUMN expense_date;

-- Rename the new column to the original name
ALTER TABLE expenses RENAME COLUMN expense_date_new TO expense_date;
