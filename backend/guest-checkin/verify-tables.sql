-- Migration Verification SQL Script
-- Verifies that all tables, columns, and indexes were created correctly

\echo '==================================='
\echo '🔍 Migration Verification'
\echo '==================================='
\echo ''

-- Check if guest_documents table exists
\echo '1. Checking guest_documents table...'
SELECT 
  CASE WHEN COUNT(*) > 0 THEN '✅ guest_documents table EXISTS' 
       ELSE '❌ guest_documents table NOT FOUND' 
  END AS result
FROM information_schema.tables
WHERE table_name = 'guest_documents';

\echo ''

-- Check guest_documents columns
\echo '2. Checking guest_documents columns...'
SELECT 
  COUNT(*) AS total_columns,
  '(Expected: 24+)' AS expected
FROM information_schema.columns
WHERE table_name = 'guest_documents';

\echo ''

-- Check if guest_audit_logs table exists
\echo '3. Checking guest_audit_logs table...'
SELECT 
  CASE WHEN COUNT(*) > 0 THEN '✅ guest_audit_logs table EXISTS' 
       ELSE '❌ guest_audit_logs table NOT FOUND' 
  END AS result
FROM information_schema.tables
WHERE table_name = 'guest_audit_logs';

\echo ''

-- Check guest_audit_logs columns
\echo '4. Checking guest_audit_logs columns...'
SELECT 
  COUNT(*) AS total_columns,
  '(Expected: 18+)' AS expected
FROM information_schema.columns
WHERE table_name = 'guest_audit_logs';

\echo ''

-- Check new guest_checkins columns
\echo '5. Checking new columns in guest_checkins...'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'guest_checkins'
  AND column_name IN ('data_source', 'data_verified', 'verified_by_user_id', 'verified_at')
ORDER BY column_name;

\echo ''

-- Check guest_documents indexes
\echo '6. Checking guest_documents indexes...'
SELECT 
  COUNT(*) AS total_indexes,
  '(Expected: 9+)' AS expected
FROM pg_indexes
WHERE tablename = 'guest_documents';

\echo ''

-- List guest_documents indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'guest_documents'
ORDER BY indexname;

\echo ''

-- Check guest_audit_logs indexes
\echo '7. Checking guest_audit_logs indexes...'
SELECT 
  COUNT(*) AS total_indexes,
  '(Expected: 11+)' AS expected
FROM pg_indexes
WHERE tablename = 'guest_audit_logs';

\echo ''

-- Check for GIN indexes
\echo '8. Checking GIN indexes (for JSONB)...'
SELECT tablename, indexname
FROM pg_indexes
WHERE (tablename = 'guest_documents' OR tablename = 'guest_audit_logs')
  AND indexdef LIKE '%USING gin%';

\echo ''

-- Check CHECK constraints
\echo '9. Checking CHECK constraints...'
SELECT 
  t.tablename,
  COUNT(DISTINCT c.conname) AS constraint_count
FROM pg_constraint c
JOIN (VALUES ('guest_documents'), ('guest_audit_logs')) AS t(tablename) 
  ON c.conrelid = t.tablename::regclass
WHERE c.contype = 'c'
GROUP BY t.tablename;

\echo ''

-- Summary
\echo '==================================='
\echo '✅ Migration Verification Complete'
\echo '==================================='

