-- Rollback migration: Remove guest documents and audit logging
-- Version: 2
-- Date: 2025-10-10

BEGIN;

-- Drop new columns from guest_checkins
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS verified_at;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS verified_by_user_id;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS data_verified;
ALTER TABLE guest_checkins DROP COLUMN IF EXISTS data_source;

-- Drop tables (CASCADE will drop dependent foreign keys)
DROP TABLE IF EXISTS guest_audit_logs CASCADE;
DROP TABLE IF EXISTS guest_documents CASCADE;

COMMIT;

