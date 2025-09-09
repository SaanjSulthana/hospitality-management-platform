-- Add foreign key constraints for receipt files
ALTER TABLE revenues ADD CONSTRAINT fk_revenues_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_receipt_file_id FOREIGN KEY (receipt_file_id) REFERENCES files(id);
