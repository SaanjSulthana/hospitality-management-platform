-- =========================================================================
-- Migration 14 DOWN: Remove added columns from partitioned tables
-- =========================================================================

-- Remove indexes
DROP INDEX IF EXISTS idx_revenues_part_source;
DROP INDEX IF EXISTS idx_revenues_part_payment_mode;
DROP INDEX IF EXISTS idx_expenses_part_expense_date;
DROP INDEX IF EXISTS idx_expenses_part_payment_mode;

-- Remove columns from revenues_partitioned
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS source;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS currency;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS receipt_url;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS meta_json;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS receipt_file_id;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS payment_mode;
ALTER TABLE revenues_partitioned DROP COLUMN IF EXISTS bank_reference;

-- Remove columns from expenses_partitioned
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS currency;
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS receipt_url;
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS expense_date;
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS receipt_file_id;
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS payment_mode;
ALTER TABLE expenses_partitioned DROP COLUMN IF EXISTS bank_reference;

