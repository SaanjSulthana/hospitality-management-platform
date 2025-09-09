-- Add receipt_file_id column to revenues table
ALTER TABLE revenues ADD COLUMN receipt_file_id INTEGER;

-- Add receipt_file_id column to expenses table  
ALTER TABLE expenses ADD COLUMN receipt_file_id INTEGER;
