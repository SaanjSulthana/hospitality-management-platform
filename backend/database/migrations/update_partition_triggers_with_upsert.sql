-- =========================================================================
-- Update Partition Triggers with ON CONFLICT Upsert Logic
-- Target: Fix dual-write triggers to handle updates properly
-- Created: October 2025
-- =========================================================================

-- This migration updates the existing triggers to use ON CONFLICT for proper
-- upsert behavior, preventing duplicate rows in partitioned tables when
-- legacy tables are updated.

-- -------------------------------------------------------------------------
-- 1. UPDATE REVENUES TRIGGER
-- -------------------------------------------------------------------------

\echo 'Updating sync_revenues_insert trigger function...'

CREATE OR REPLACE FUNCTION sync_revenues_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO revenues_partitioned (
    id, org_id, property_id, amount_cents, occurred_at, description,
    category, payment_method, reference_number, status,
    approved_by_user_id, approved_at, created_by_user_id,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.org_id, NEW.property_id, NEW.amount_cents, NEW.occurred_at,
    NEW.description, NEW.category, NEW.payment_method,
    NEW.reference_number, NEW.status, NEW.approved_by_user_id,
    NEW.approved_at, NEW.created_by_user_id, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id, occurred_at)
  DO UPDATE SET
    org_id = EXCLUDED.org_id,
    property_id = EXCLUDED.property_id,
    amount_cents = EXCLUDED.amount_cents,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    payment_method = EXCLUDED.payment_method,
    reference_number = EXCLUDED.reference_number,
    status = EXCLUDED.status,
    approved_by_user_id = EXCLUDED.approved_by_user_id,
    approved_at = EXCLUDED.approved_at,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo 'Revenues trigger function updated successfully.'

-- -------------------------------------------------------------------------
-- 2. UPDATE EXPENSES TRIGGER
-- -------------------------------------------------------------------------

\echo 'Updating sync_expenses_insert trigger function...'

CREATE OR REPLACE FUNCTION sync_expenses_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expenses_partitioned (
    id, org_id, property_id, amount_cents, occurred_at, description,
    category, payment_method, vendor_name, reference_number, status,
    approved_by_user_id, approved_at, created_by_user_id,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.org_id, NEW.property_id, NEW.amount_cents, NEW.occurred_at,
    NEW.description, NEW.category, NEW.payment_method, NEW.vendor_name,
    NEW.reference_number, NEW.status, NEW.approved_by_user_id,
    NEW.approved_at, NEW.created_by_user_id, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id, occurred_at)
  DO UPDATE SET
    org_id = EXCLUDED.org_id,
    property_id = EXCLUDED.property_id,
    amount_cents = EXCLUDED.amount_cents,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    payment_method = EXCLUDED.payment_method,
    vendor_name = EXCLUDED.vendor_name,
    reference_number = EXCLUDED.reference_number,
    status = EXCLUDED.status,
    approved_by_user_id = EXCLUDED.approved_by_user_id,
    approved_at = EXCLUDED.approved_at,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

\echo 'Expenses trigger function updated successfully.'

-- -------------------------------------------------------------------------
-- 3. VERIFY TRIGGER INSTALLATION
-- -------------------------------------------------------------------------

\echo ''
\echo 'Verifying trigger installation...'

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

-- -------------------------------------------------------------------------
-- 4. COMMENTS
-- -------------------------------------------------------------------------

COMMENT ON FUNCTION sync_revenues_insert() IS 'Dual-write trigger function that syncs revenues table changes to revenues_partitioned with ON CONFLICT upsert handling';
COMMENT ON FUNCTION sync_expenses_insert() IS 'Dual-write trigger function that syncs expenses table changes to expenses_partitioned with ON CONFLICT upsert handling';

\echo ''
\echo '========================================='
\echo 'Trigger Update Complete!'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Test trigger behavior using test_trigger_upserts.sql'
\echo '2. Verify dual-write parity using verify_dual_write_parity.sql'
\echo '3. Monitor trigger performance in production'
\echo ''

