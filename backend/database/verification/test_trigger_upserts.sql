-- =========================================================================
-- Trigger Upsert Behavior Test Script
-- Purpose: Test INSERT and UPDATE trigger behavior with ON CONFLICT handling
-- Usage: psql -d hospitality -f test_trigger_upserts.sql
-- =========================================================================

\echo '========================================='
\echo 'Trigger Upsert Behavior Tests'
\echo '========================================='
\echo ''

-- Set up test organization ID to avoid conflicts
\set test_org_id 999999
\set test_property_id 1

-- -------------------------------------------------------------------------
-- SETUP: Clean up any existing test data
-- -------------------------------------------------------------------------

\echo 'Cleaning up test data...'
DELETE FROM daily_cash_balances WHERE org_id = :test_org_id;
DELETE FROM daily_cash_balances_partitioned WHERE org_id = :test_org_id;
DELETE FROM revenues WHERE org_id = :test_org_id;
DELETE FROM revenues_partitioned WHERE org_id = :test_org_id;
DELETE FROM expenses WHERE org_id = :test_org_id;
DELETE FROM expenses_partitioned WHERE org_id = :test_org_id;

\echo 'Setup complete.'
\echo ''

-- -------------------------------------------------------------------------
-- TEST 1: Daily Cash Balances - Insert Trigger
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 1: Daily Cash Balances - Insert'
\echo '========================================='

\echo 'Inserting record into legacy table...'
INSERT INTO daily_cash_balances (
  org_id, property_id, balance_date,
  opening_balance_cents, cash_received_cents, bank_received_cents,
  cash_expenses_cents, bank_expenses_cents, closing_balance_cents,
  created_by_user_id, created_at, updated_at
) VALUES (
  :test_org_id, :test_property_id, '2025-10-29',
  100000, 50000, 30000,
  20000, 10000, 150000,
  1, NOW(), NOW()
);

\echo 'Verifying sync to partitioned table...'
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: Record synced to partitioned table'
    ELSE '✗ FAIL: Record not synced'
  END AS test_result
FROM daily_cash_balances_partitioned
WHERE org_id = :test_org_id
  AND property_id = :test_property_id
  AND balance_date = '2025-10-29';

\echo 'Verifying data integrity...'
SELECT 
  CASE 
    WHEN l.opening_balance_cents = p.opening_balance_cents
     AND l.closing_balance_cents = p.closing_balance_cents
     AND l.cash_received_cents = p.cash_received_cents
    THEN '✓ PASS: Data integrity maintained'
    ELSE '✗ FAIL: Data mismatch detected'
  END AS test_result
FROM daily_cash_balances l
INNER JOIN daily_cash_balances_partitioned p
  ON l.org_id = p.org_id
  AND l.property_id = p.property_id
  AND l.balance_date = p.balance_date
WHERE l.org_id = :test_org_id
  AND l.balance_date = '2025-10-29';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 2: Daily Cash Balances - Update Trigger (ON CONFLICT)
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 2: Daily Cash Balances - Update'
\echo '========================================='

\echo 'Updating record in legacy table...'
UPDATE daily_cash_balances
SET closing_balance_cents = 200000,
    cash_received_cents = 80000,
    updated_at = NOW()
WHERE org_id = :test_org_id
  AND property_id = :test_property_id
  AND balance_date = '2025-10-29';

\echo 'Verifying update sync to partitioned table...'
SELECT 
  CASE 
    WHEN closing_balance_cents = 200000 
     AND cash_received_cents = 80000
    THEN '✓ PASS: Update synced correctly'
    ELSE '✗ FAIL: Update not synced'
  END AS test_result
FROM daily_cash_balances_partitioned
WHERE org_id = :test_org_id
  AND property_id = :test_property_id
  AND balance_date = '2025-10-29';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 3: Daily Cash Balances - Duplicate Insert (ON CONFLICT)
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 3: Daily Cash Balances - Duplicate'
\echo '========================================='

\echo 'Attempting duplicate insert with ON CONFLICT...'
INSERT INTO daily_cash_balances (
  org_id, property_id, balance_date,
  opening_balance_cents, closing_balance_cents,
  created_by_user_id, created_at, updated_at
) VALUES (
  :test_org_id, :test_property_id, '2025-10-29',
  120000, 250000,
  1, NOW(), NOW()
)
ON CONFLICT (org_id, property_id, balance_date)
DO UPDATE SET
  opening_balance_cents = EXCLUDED.opening_balance_cents,
  closing_balance_cents = EXCLUDED.closing_balance_cents,
  updated_at = EXCLUDED.updated_at;

\echo 'Verifying no duplicate rows created...'
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: Only one row exists (no duplicate)'
    ELSE '✗ FAIL: Duplicate rows detected: ' || COUNT(*)
  END AS test_result
FROM daily_cash_balances_partitioned
WHERE org_id = :test_org_id
  AND property_id = :test_property_id
  AND balance_date = '2025-10-29';

\echo 'Verifying values updated correctly...'
SELECT 
  CASE 
    WHEN opening_balance_cents = 120000 
     AND closing_balance_cents = 250000
    THEN '✓ PASS: Values updated via ON CONFLICT'
    ELSE '✗ FAIL: Values not updated correctly'
  END AS test_result,
  opening_balance_cents,
  closing_balance_cents
FROM daily_cash_balances_partitioned
WHERE org_id = :test_org_id
  AND property_id = :test_property_id
  AND balance_date = '2025-10-29';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 4: Revenues - Insert Trigger
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 4: Revenues - Insert'
\echo '========================================='

\echo 'Inserting revenue record...'
INSERT INTO revenues (
  org_id, property_id, amount_cents, occurred_at,
  description, category, payment_method, status,
  created_by_user_id, created_at, updated_at
) VALUES (
  :test_org_id, :test_property_id, 500000, '2025-10-29 10:00:00',
  'Test Revenue - Room Booking', 'room', 'cash', 'pending',
  1, NOW(), NOW()
);

\echo 'Verifying sync to partitioned revenues...'
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: Revenue synced'
    ELSE '✗ FAIL: Revenue not synced'
  END AS test_result
FROM revenues_partitioned
WHERE org_id = :test_org_id
  AND description = 'Test Revenue - Room Booking';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 5: Revenues - Update Trigger
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 5: Revenues - Update'
\echo '========================================='

\echo 'Updating revenue status...'
UPDATE revenues
SET status = 'approved',
    amount_cents = 550000,
    updated_at = NOW()
WHERE org_id = :test_org_id
  AND description = 'Test Revenue - Room Booking';

\echo 'Verifying update sync...'
SELECT 
  CASE 
    WHEN status = 'approved' AND amount_cents = 550000
    THEN '✓ PASS: Revenue update synced'
    ELSE '✗ FAIL: Revenue update not synced'
  END AS test_result,
  status,
  amount_cents
FROM revenues_partitioned
WHERE org_id = :test_org_id
  AND description = 'Test Revenue - Room Booking';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 6: Revenues - Duplicate Insert with ON CONFLICT
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 6: Revenues - Duplicate Handling'
\echo '========================================='

\echo 'Getting revenue ID for duplicate test...'
\set revenue_id '(SELECT id FROM revenues WHERE org_id = :test_org_id AND description = \'Test Revenue - Room Booking\')'

\echo 'Attempting duplicate insert with ON CONFLICT...'
-- Note: This requires id + occurred_at in primary key
INSERT INTO revenues (
  id, org_id, property_id, amount_cents, occurred_at,
  description, status, created_by_user_id, created_at, updated_at
)
SELECT 
  id, org_id, property_id, 600000, occurred_at,
  'Test Revenue - Room Booking (Updated)', 'approved', 1, NOW(), NOW()
FROM revenues
WHERE org_id = :test_org_id
  AND description = 'Test Revenue - Room Booking'
ON CONFLICT (id, occurred_at)
DO UPDATE SET
  amount_cents = EXCLUDED.amount_cents,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;

\echo 'Verifying no duplicate in partitioned table...'
SELECT 
  CASE 
    WHEN COUNT(*) <= 1 THEN '✓ PASS: No duplicate revenue rows'
    ELSE '✗ FAIL: Duplicate rows detected: ' || COUNT(*)
  END AS test_result
FROM revenues_partitioned
WHERE org_id = :test_org_id;

\echo ''

-- -------------------------------------------------------------------------
-- TEST 7: Expenses - Insert Trigger
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 7: Expenses - Insert'
\echo '========================================='

\echo 'Inserting expense record...'
INSERT INTO expenses (
  org_id, property_id, amount_cents, occurred_at,
  description, category, payment_method, vendor_name, status,
  created_by_user_id, created_at, updated_at
) VALUES (
  :test_org_id, :test_property_id, 300000, '2025-10-29 11:00:00',
  'Test Expense - Utilities', 'utilities', 'bank', 'Power Company', 'pending',
  1, NOW(), NOW()
);

\echo 'Verifying sync to partitioned expenses...'
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✓ PASS: Expense synced'
    ELSE '✗ FAIL: Expense not synced'
  END AS test_result
FROM expenses_partitioned
WHERE org_id = :test_org_id
  AND description = 'Test Expense - Utilities';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 8: Expenses - Update Trigger
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 8: Expenses - Update'
\echo '========================================='

\echo 'Updating expense status...'
UPDATE expenses
SET status = 'approved',
    amount_cents = 320000,
    updated_at = NOW()
WHERE org_id = :test_org_id
  AND description = 'Test Expense - Utilities';

\echo 'Verifying update sync...'
SELECT 
  CASE 
    WHEN status = 'approved' AND amount_cents = 320000
    THEN '✓ PASS: Expense update synced'
    ELSE '✗ FAIL: Expense update not synced'
  END AS test_result,
  status,
  amount_cents
FROM expenses_partitioned
WHERE org_id = :test_org_id
  AND description = 'Test Expense - Utilities';

\echo ''

-- -------------------------------------------------------------------------
-- TEST 9: Bulk Insert Performance
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST 9: Bulk Insert Test (10 records)'
\echo '========================================='

\echo 'Inserting 10 daily cash balance records...'
INSERT INTO daily_cash_balances (
  org_id, property_id, balance_date,
  opening_balance_cents, closing_balance_cents,
  created_by_user_id, created_at, updated_at
)
SELECT 
  :test_org_id,
  :test_property_id,
  ('2025-10-' || LPAD(i::text, 2, '0'))::date,
  100000 + (i * 10000),
  150000 + (i * 10000),
  1,
  NOW(),
  NOW()
FROM generate_series(1, 10) AS i
WHERE i BETWEEN 1 AND 10;

\echo 'Verifying bulk sync...'
SELECT 
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM daily_cash_balances WHERE org_id = :test_org_id) =
      (SELECT COUNT(*) FROM daily_cash_balances_partitioned WHERE org_id = :test_org_id)
    THEN '✓ PASS: All bulk records synced (' || COUNT(*) || ' records)'
    ELSE '✗ FAIL: Bulk sync incomplete'
  END AS test_result
FROM daily_cash_balances_partitioned
WHERE org_id = :test_org_id;

\echo ''

-- -------------------------------------------------------------------------
-- TEST SUMMARY
-- -------------------------------------------------------------------------

\echo '========================================='
\echo 'TEST SUMMARY'
\echo '========================================='

\echo 'Row counts per table:'
SELECT 
  'daily_cash_balances' as table_name,
  (SELECT COUNT(*) FROM daily_cash_balances WHERE org_id = :test_org_id) as legacy_count,
  (SELECT COUNT(*) FROM daily_cash_balances_partitioned WHERE org_id = :test_org_id) as partitioned_count
UNION ALL
SELECT 
  'revenues' as table_name,
  (SELECT COUNT(*) FROM revenues WHERE org_id = :test_org_id) as legacy_count,
  (SELECT COUNT(*) FROM revenues_partitioned WHERE org_id = :test_org_id) as partitioned_count
UNION ALL
SELECT 
  'expenses' as table_name,
  (SELECT COUNT(*) FROM expenses WHERE org_id = :test_org_id) as legacy_count,
  (SELECT COUNT(*) FROM expenses_partitioned WHERE org_id = :test_org_id) as partitioned_count;

\echo ''

-- -------------------------------------------------------------------------
-- CLEANUP
-- -------------------------------------------------------------------------

\echo 'Cleaning up test data...'
DELETE FROM daily_cash_balances WHERE org_id = :test_org_id;
DELETE FROM daily_cash_balances_partitioned WHERE org_id = :test_org_id;
DELETE FROM revenues WHERE org_id = :test_org_id;
DELETE FROM revenues_partitioned WHERE org_id = :test_org_id;
DELETE FROM expenses WHERE org_id = :test_org_id;
DELETE FROM expenses_partitioned WHERE org_id = :test_org_id;

\echo ''
\echo '========================================='
\echo 'All tests complete!'
\echo '========================================='

