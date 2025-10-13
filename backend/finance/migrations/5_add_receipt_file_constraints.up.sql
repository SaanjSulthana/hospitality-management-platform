-- Add foreign key constraints for receipt files (only if tables and columns exist)
DO $$
BEGIN
    -- Add constraint to revenues table if it exists and has the column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues' AND column_name = 'receipt_file_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'revenues' AND constraint_name = 'fk_revenues_receipt_file_id') THEN
        ALTER TABLE revenues ADD CONSTRAINT fk_revenues_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);
    END IF;
    
    -- Add constraint to expenses table if it exists and has the column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'receipt_file_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'expenses' AND constraint_name = 'fk_expenses_receipt_file_id') THEN
        ALTER TABLE expenses ADD CONSTRAINT fk_expenses_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);
    END IF;
END $$;
