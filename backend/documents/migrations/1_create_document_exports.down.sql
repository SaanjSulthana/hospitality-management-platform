DROP INDEX IF EXISTS idx_document_exports_user_list;
DROP INDEX IF EXISTS idx_document_exports_created_at;
DROP INDEX IF EXISTS idx_document_exports_expires_at;
DROP INDEX IF EXISTS idx_document_exports_status;
DROP INDEX IF EXISTS idx_document_exports_org_user;
DROP INDEX IF EXISTS idx_document_exports_export_id;
DROP TABLE IF EXISTS document_exports CASCADE;

