-- Rollback migration for document cleanup fields

DROP INDEX IF EXISTS idx_guest_documents_cleanup;

ALTER TABLE guest_documents 
DROP COLUMN IF EXISTS is_temporary,
DROP COLUMN IF EXISTS expires_at;

