-- Revert expense_date column back to DATE type
-- This will lose time information but preserve the date

-- First, add a new column with the original type
ALTER TABLE expenses ADD COLUMN expense_date_old DATE;

-- Copy existing data, converting TIMESTAMPTZ to DATE (loses time info)
UPDATE expenses SET expense_date_old = expense_date::DATE;

-- Make the new column NOT NULL
ALTER TABLE expenses ALTER COLUMN expense_date_old SET NOT NULL;

-- Drop the new column
ALTER TABLE expenses DROP COLUMN expense_date;

-- Rename the old column back to the original name
ALTER TABLE expenses RENAME COLUMN expense_date_old TO expense_date;
