-- Alter file_size column from INTEGER to BIGINT to support larger files
-- This migration is idempotent and safe to run multiple times

DO $$ 
BEGIN
    -- Check if column is already BIGINT
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' 
        AND column_name = 'file_size' 
        AND data_type = 'bigint'
    ) THEN
        ALTER TABLE files 
        ALTER COLUMN file_size TYPE BIGINT;
    END IF;
END $$;

