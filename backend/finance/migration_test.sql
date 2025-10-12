-- Test Migration Order
-- This script tests if migrations run in correct order

-- Check if revenues table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'revenues') 
    THEN 'revenues table EXISTS' 
    ELSE 'revenues table MISSING' 
  END as revenues_status;

-- Check if expenses table exists  
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenses') 
    THEN 'expenses table EXISTS' 
    ELSE 'expenses table MISSING' 
  END as expenses_status;

-- Check migration state
SELECT version, dirty FROM schema_migrations ORDER BY version;