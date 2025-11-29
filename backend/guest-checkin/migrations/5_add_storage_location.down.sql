-- Rollback storage location tracking

DROP INDEX IF EXISTS idx_guest_documents_storage_location;
ALTER TABLE guest_documents DROP COLUMN IF EXISTS bucket_key;
ALTER TABLE guest_documents DROP COLUMN IF EXISTS storage_location;


