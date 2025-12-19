-- =========================================================================
-- Migration 14: Add missing columns to partitioned tables
-- Purpose: Align partitioned tables with main hospitality database schema
-- Created: December 2025
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Add missing columns to revenues_partitioned
-- -------------------------------------------------------------------------

-- Source column (matches revenues.source in hospitality DB)
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS source TEXT;

-- Currency column
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

-- Receipt URL for storing receipt image links
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Meta JSON for additional metadata
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS meta_json JSONB;

-- Receipt file ID for file management
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;

-- Payment mode (cash, bank, upi, etc.)
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';

-- Bank reference for bank transactions
ALTER TABLE revenues_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- -------------------------------------------------------------------------
-- 2. Add missing columns to expenses_partitioned
-- -------------------------------------------------------------------------

-- Currency column
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

-- Receipt URL for storing receipt image links
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Expense date (separate from occurred_at timestamp)
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS expense_date DATE;

-- Receipt file ID for file management
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;

-- Payment mode (cash, bank, upi, etc.)
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';

-- Bank reference for bank transactions
ALTER TABLE expenses_partitioned ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- -------------------------------------------------------------------------
-- 3. Set default expense_date from occurred_at for existing rows
-- -------------------------------------------------------------------------

UPDATE expenses_partitioned 
SET expense_date = DATE(occurred_at) 
WHERE expense_date IS NULL AND occurred_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- 4. Create indexes for new columns
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_revenues_part_source ON revenues_partitioned(source);
CREATE INDEX IF NOT EXISTS idx_revenues_part_payment_mode ON revenues_partitioned(payment_mode);
CREATE INDEX IF NOT EXISTS idx_expenses_part_expense_date ON expenses_partitioned(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_part_payment_mode ON expenses_partitioned(payment_mode);

-- -------------------------------------------------------------------------
-- 5. Update sync triggers to include new columns
-- -------------------------------------------------------------------------

-- Drop and recreate revenues sync trigger function
CREATE OR REPLACE FUNCTION sync_revenues_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO revenues_partitioned (
    id, org_id, property_id, amount_cents, occurred_at, description,
    category, payment_method, reference_number, status,
    approved_by_user_id, approved_at, created_by_user_id,
    created_at, updated_at,
    -- New columns
    source, currency, receipt_url, meta_json, receipt_file_id, payment_mode, bank_reference
  ) VALUES (
    NEW.id, NEW.org_id, NEW.property_id, NEW.amount_cents, 
    COALESCE(NEW.occurred_at, NOW()),
    NEW.description, 
    COALESCE(NEW.category, NEW.source), -- Use source as category fallback
    COALESCE(NEW.payment_method, NEW.payment_mode),
    NEW.reference_number, NEW.status, NEW.approved_by_user_id,
    NEW.approved_at, NEW.created_by_user_id, NEW.created_at, NEW.updated_at,
    -- New column values
    NEW.source, NEW.currency, NEW.receipt_url, NEW.meta_json, 
    NEW.receipt_file_id, NEW.payment_mode, NEW.bank_reference
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
    updated_at = EXCLUDED.updated_at,
    -- New columns update
    source = EXCLUDED.source,
    currency = EXCLUDED.currency,
    receipt_url = EXCLUDED.receipt_url,
    meta_json = EXCLUDED.meta_json,
    receipt_file_id = EXCLUDED.receipt_file_id,
    payment_mode = EXCLUDED.payment_mode,
    bank_reference = EXCLUDED.bank_reference;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN
  -- Fallback for tables that don't have all columns yet
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate expenses sync trigger function
CREATE OR REPLACE FUNCTION sync_expenses_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expenses_partitioned (
    id, org_id, property_id, amount_cents, occurred_at, description,
    category, payment_method, vendor_name, reference_number, status,
    approved_by_user_id, approved_at, created_by_user_id,
    created_at, updated_at,
    -- New columns
    currency, receipt_url, expense_date, receipt_file_id, payment_mode, bank_reference
  ) VALUES (
    NEW.id, NEW.org_id, NEW.property_id, NEW.amount_cents, 
    COALESCE(NEW.occurred_at, NEW.expense_date::timestamp, NOW()),
    NEW.description, NEW.category, 
    COALESCE(NEW.payment_method, NEW.payment_mode), 
    NEW.vendor_name,
    NEW.reference_number, NEW.status, NEW.approved_by_user_id,
    NEW.approved_at, NEW.created_by_user_id, NEW.created_at, NEW.updated_at,
    -- New column values
    NEW.currency, NEW.receipt_url, 
    COALESCE(NEW.expense_date, DATE(NEW.occurred_at)),
    NEW.receipt_file_id, NEW.payment_mode, NEW.bank_reference
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
    updated_at = EXCLUDED.updated_at,
    -- New columns update
    currency = EXCLUDED.currency,
    receipt_url = EXCLUDED.receipt_url,
    expense_date = EXCLUDED.expense_date,
    receipt_file_id = EXCLUDED.receipt_file_id,
    payment_mode = EXCLUDED.payment_mode,
    bank_reference = EXCLUDED.bank_reference;
  RETURN NEW;
EXCEPTION WHEN undefined_column THEN
  -- Fallback for tables that don't have all columns yet
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- MIGRATION COMPLETE
-- This migration adds missing columns to align partitioned tables
-- with the main hospitality database schema for 10M+ org scaling
-- =========================================================================

