-- Rollback storage location tracking

DROP INDEX IF EXISTS idx_files_storage_location;
ALTER TABLE files DROP COLUMN IF EXISTS bucket_key;
ALTER TABLE files DROP COLUMN IF EXISTS storage_location;


