-- =========================================================================
-- Migration 14 DOWN: Remove added columns from partitioned tables
-- This is a safe rollback that only removes columns if they exist
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues_partitioned') THEN
    -- Drop indexes first
    DROP INDEX IF EXISTS idx_revenues_part_source;
    DROP INDEX IF EXISTS idx_revenues_part_created_by;
    
    -- Remove columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'source') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'currency') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN currency;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'receipt_url') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN receipt_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'meta_json') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN meta_json;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'receipt_file_id') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN receipt_file_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'bank_reference') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN bank_reference;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN created_by_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'approved_by_user_id') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN approved_by_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenues_partitioned' AND column_name = 'approved_at') THEN
      ALTER TABLE revenues_partitioned DROP COLUMN approved_at;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses_partitioned') THEN
    -- Drop indexes first
    DROP INDEX IF EXISTS idx_expenses_part_created_by;
    DROP INDEX IF EXISTS idx_expenses_part_expense_date;
    
    -- Remove columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'currency') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN currency;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'receipt_url') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN receipt_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'receipt_file_id') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN receipt_file_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'bank_reference') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN bank_reference;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'created_by_user_id') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN created_by_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'approved_by_user_id') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN approved_by_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses_partitioned' AND column_name = 'approved_at') THEN
      ALTER TABLE expenses_partitioned DROP COLUMN approved_at;
    END IF;
  END IF;
END $$;
