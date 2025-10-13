-- Verification script for migration 2
-- Run this to verify guest_documents and guest_audit_logs tables exist

-- Check if guest_documents table exists
SELECT 'guest_documents table' AS check_name, 
       COUNT(*) AS exists_count
FROM information_schema.tables 
WHERE table_name = 'guest_documents';

-- Check if guest_audit_logs table exists
SELECT 'guest_audit_logs table' AS check_name,
       COUNT(*) AS exists_count
FROM information_schema.tables 
WHERE table_name = 'guest_audit_logs';

-- Check new columns in guest_checkins
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'guest_checkins'
  AND column_name IN ('data_source', 'data_verified', 'verified_by_user_id', 'verified_at')
ORDER BY column_name;

-- Count indexes on guest_documents
SELECT COUNT(*) AS guest_documents_indexes
FROM pg_indexes
WHERE tablename = 'guest_documents';

-- Count indexes on guest_audit_logs
SELECT COUNT(*) AS guest_audit_logs_indexes
FROM pg_indexes
WHERE tablename = 'guest_audit_logs';

