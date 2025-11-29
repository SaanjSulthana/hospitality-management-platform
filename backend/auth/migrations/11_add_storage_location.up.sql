-- Add storage location tracking to files table
-- This enables hybrid storage: existing files on local disk, new files in Encore buckets

-- Only run if the 'files' table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'files'
    ) THEN
        -- Add storage_location column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'files' AND column_name = 'storage_location'
        ) THEN
            ALTER TABLE files 
            ADD COLUMN storage_location VARCHAR(20) DEFAULT 'local' CHECK (storage_location IN ('local', 'cloud'));
        END IF;

        -- Add bucket_key column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'files' AND column_name = 'bucket_key'
        ) THEN
            ALTER TABLE files
            ADD COLUMN bucket_key VARCHAR(500); -- Path in bucket (null for local files)
        END IF;

        -- Create index for efficient filtering by storage location (if it doesn't exist)
        PERFORM 1 FROM pg_indexes WHERE indexname = 'idx_files_storage_location';
        IF NOT FOUND THEN
            CREATE INDEX idx_files_storage_location ON files(storage_location);
        END IF;

        -- Update existing records to be marked as 'local'
        UPDATE files SET storage_location = 'local' WHERE storage_location IS NULL;
    END IF;
END $$;


