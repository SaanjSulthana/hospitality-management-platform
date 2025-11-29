-- =========================================================================
-- Dual-Write Parity Verification Script
-- Purpose: Verify data consistency between legacy and partitioned tables
-- Usage: psql -d hospitality -f verify_dual_write_parity.sql
-- =========================================================================

\echo '========================================='
\echo 'Dual-Write Parity Verification'
\echo '========================================='
\echo ''

-- -------------------------------------------------------------------------
-- 1. ROW COUNT COMPARISON
-- -------------------------------------------------------------------------

\echo '1. ROW COUNT COMPARISON'
\echo '---------------------------------------'

\echo 'Daily Cash Balances:'
SELECT 
  'Legacy' as table_type,
  COUNT(*) as row_count
FROM daily_cash_balances
UNION ALL
SELECT 
  'Partitioned' as table_type,
  COUNT(*) as row_count
FROM daily_cash_balances_partitioned
ORDER BY table_type;

\echo ''
\echo 'Revenues:'
SELECT 
  'Legacy' as table_type,
  COUNT(*) as row_count
FROM revenues
UNION ALL
SELECT 
  'Partitioned' as table_type,
  COUNT(*) as row_count
FROM revenues_partitioned
ORDER BY table_type;

\echo ''
\echo 'Expenses:'
SELECT 
  'Legacy' as table_type,
  COUNT(*) as row_count
FROM expenses
UNION ALL
SELECT 
  'Partitioned' as table_type,
  COUNT(*) as row_count
FROM expenses_partitioned
ORDER BY table_type;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 2. ROW-BY-ROW COMPARISON - Daily Cash Balances
-- -------------------------------------------------------------------------

\echo '2. ROW-BY-ROW COMPARISON'
\echo '---------------------------------------'

\echo 'Daily Cash Balances - Missing in Partitioned:'
SELECT 
  l.org_id,
  l.property_id,
  l.balance_date,
  l.opening_balance_cents,
  l.closing_balance_cents
FROM daily_cash_balances l
LEFT JOIN daily_cash_balances_partitioned p
  ON l.org_id = p.org_id
  AND l.property_id = p.property_id
  AND l.balance_date = p.balance_date
WHERE p.org_id IS NULL
LIMIT 10;

\echo ''
\echo 'Daily Cash Balances - Missing in Legacy:'
SELECT 
  p.org_id,
  p.property_id,
  p.balance_date,
  p.opening_balance_cents,
  p.closing_balance_cents
FROM daily_cash_balances_partitioned p
LEFT JOIN daily_cash_balances l
  ON p.org_id = l.org_id
  AND p.property_id = l.property_id
  AND p.balance_date = l.balance_date
WHERE l.org_id IS NULL
LIMIT 10;

\echo ''
\echo 'Daily Cash Balances - Value Mismatches:'
SELECT 
  l.org_id,
  l.property_id,
  l.balance_date,
  l.opening_balance_cents as legacy_opening,
  p.opening_balance_cents as partitioned_opening,
  l.closing_balance_cents as legacy_closing,
  p.closing_balance_cents as partitioned_closing
FROM daily_cash_balances l
INNER JOIN daily_cash_balances_partitioned p
  ON l.org_id = p.org_id
  AND l.property_id = p.property_id
  AND l.balance_date = p.balance_date
WHERE 
  l.opening_balance_cents <> p.opening_balance_cents
  OR l.closing_balance_cents <> p.closing_balance_cents
  OR l.cash_received_cents <> p.cash_received_cents
  OR l.bank_received_cents <> p.bank_received_cents
LIMIT 10;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 3. ROW-BY-ROW COMPARISON - Revenues
-- -------------------------------------------------------------------------

\echo 'Revenues - Missing in Partitioned:'
SELECT 
  l.id,
  l.org_id,
  l.property_id,
  l.amount_cents,
  l.occurred_at,
  l.status
FROM revenues l
LEFT JOIN revenues_partitioned p
  ON l.id = p.id
  AND l.occurred_at = p.occurred_at
WHERE p.id IS NULL
LIMIT 10;

\echo ''
\echo 'Revenues - Missing in Legacy:'
SELECT 
  p.id,
  p.org_id,
  p.property_id,
  p.amount_cents,
  p.occurred_at,
  p.status
FROM revenues_partitioned p
LEFT JOIN revenues l
  ON p.id = l.id
  AND p.occurred_at = l.occurred_at
WHERE l.id IS NULL
LIMIT 10;

\echo ''
\echo 'Revenues - Value Mismatches:'
SELECT 
  l.id,
  l.org_id,
  l.amount_cents as legacy_amount,
  p.amount_cents as partitioned_amount,
  l.status as legacy_status,
  p.status as partitioned_status,
  l.occurred_at
FROM revenues l
INNER JOIN revenues_partitioned p
  ON l.id = p.id
  AND l.occurred_at = p.occurred_at
WHERE 
  l.amount_cents <> p.amount_cents
  OR l.status <> p.status
  OR COALESCE(l.description, '') <> COALESCE(p.description, '')
LIMIT 10;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 4. ROW-BY-ROW COMPARISON - Expenses
-- -------------------------------------------------------------------------

\echo 'Expenses - Missing in Partitioned:'
SELECT 
  l.id,
  l.org_id,
  l.property_id,
  l.amount_cents,
  l.occurred_at,
  l.status
FROM expenses l
LEFT JOIN expenses_partitioned p
  ON l.id = p.id
  AND l.occurred_at = p.occurred_at
WHERE p.id IS NULL
LIMIT 10;

\echo ''
\echo 'Expenses - Missing in Legacy:'
SELECT 
  p.id,
  p.org_id,
  p.property_id,
  p.amount_cents,
  p.occurred_at,
  p.status
FROM expenses_partitioned p
LEFT JOIN expenses l
  ON p.id = l.id
  AND p.occurred_at = l.occurred_at
WHERE l.id IS NULL
LIMIT 10;

\echo ''
\echo 'Expenses - Value Mismatches:'
SELECT 
  l.id,
  l.org_id,
  l.amount_cents as legacy_amount,
  p.amount_cents as partitioned_amount,
  l.status as legacy_status,
  p.status as partitioned_status,
  l.occurred_at
FROM expenses l
INNER JOIN expenses_partitioned p
  ON l.id = p.id
  AND l.occurred_at = p.occurred_at
WHERE 
  l.amount_cents <> p.amount_cents
  OR l.status <> p.status
  OR COALESCE(l.description, '') <> COALESCE(p.description, '')
LIMIT 10;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 5. TRIGGER EXISTENCE VERIFICATION
-- -------------------------------------------------------------------------

\echo '3. TRIGGER VERIFICATION'
\echo '---------------------------------------'

\echo 'Active Triggers:'
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END AS status
FROM pg_trigger t
INNER JOIN pg_class c ON t.tgrelid = c.oid
INNER JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('daily_cash_balances', 'revenues', 'expenses')
  AND t.tgname LIKE 'sync_to_partitioned_%'
ORDER BY c.relname, t.tgname;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 6. PARTITION STATISTICS
-- -------------------------------------------------------------------------

\echo '4. PARTITION STATISTICS'
\echo '---------------------------------------'

\echo 'Daily Cash Balances Partition Distribution:'
SELECT 
  tableoid::regclass AS partition_name,
  COUNT(*) as row_count,
  MIN(org_id) as min_org_id,
  MAX(org_id) as max_org_id
FROM daily_cash_balances_partitioned
GROUP BY tableoid
ORDER BY partition_name;

\echo ''
\echo 'Revenues Partition Distribution (Monthly):'
SELECT 
  tableoid::regclass AS partition_name,
  COUNT(*) as row_count,
  MIN(occurred_at) as earliest_transaction,
  MAX(occurred_at) as latest_transaction
FROM revenues_partitioned
GROUP BY tableoid
ORDER BY partition_name;

\echo ''
\echo 'Expenses Partition Distribution (Monthly):'
SELECT 
  tableoid::regclass AS partition_name,
  COUNT(*) as row_count,
  MIN(occurred_at) as earliest_transaction,
  MAX(occurred_at) as latest_transaction
FROM expenses_partitioned
GROUP BY tableoid
ORDER BY partition_name;

\echo ''
\echo '---------------------------------------'
\echo ''

-- -------------------------------------------------------------------------
-- 7. SUMMARY CHECKSUMS
-- -------------------------------------------------------------------------

\echo '5. DATA CHECKSUMS (For Integrity Verification)'
\echo '---------------------------------------'

\echo 'Daily Cash Balances - Sum Comparison:'
SELECT 
  'Legacy' as table_type,
  SUM(opening_balance_cents) as total_opening,
  SUM(closing_balance_cents) as total_closing,
  SUM(cash_received_cents) as total_cash_received,
  SUM(bank_received_cents) as total_bank_received
FROM daily_cash_balances
UNION ALL
SELECT 
  'Partitioned' as table_type,
  SUM(opening_balance_cents) as total_opening,
  SUM(closing_balance_cents) as total_closing,
  SUM(cash_received_cents) as total_cash_received,
  SUM(bank_received_cents) as total_bank_received
FROM daily_cash_balances_partitioned
ORDER BY table_type;

\echo ''
\echo 'Revenues - Sum Comparison:'
SELECT 
  'Legacy' as table_type,
  SUM(amount_cents) as total_amount,
  COUNT(*) as transaction_count
FROM revenues
UNION ALL
SELECT 
  'Partitioned' as table_type,
  SUM(amount_cents) as total_amount,
  COUNT(*) as transaction_count
FROM revenues_partitioned
ORDER BY table_type;

\echo ''
\echo 'Expenses - Sum Comparison:'
SELECT 
  'Legacy' as table_type,
  SUM(amount_cents) as total_amount,
  COUNT(*) as transaction_count
FROM expenses
UNION ALL
SELECT 
  'Partitioned' as table_type,
  SUM(amount_cents) as total_amount,
  COUNT(*) as transaction_count
FROM expenses_partitioned
ORDER BY table_type;

\echo ''
\echo '========================================='
\echo 'Verification Complete'
\echo '========================================='

