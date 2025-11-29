-- =========================================================================
-- Database Partitioning Migration - Phase 2 Architecture Scaling
-- Target: Handle 100K-500K organizations with linear scaling
-- Created: October 2025
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. DAILY CASH BALANCES - Hash Partitioning by org_id (16 partitions)
-- -------------------------------------------------------------------------

-- Create partitioned table
CREATE TABLE IF NOT EXISTS daily_cash_balances_partitioned (
  id SERIAL,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  balance_date DATE NOT NULL,
  opening_balance_cents INTEGER DEFAULT 0,
  cash_received_cents INTEGER DEFAULT 0,
  bank_received_cents INTEGER DEFAULT 0,
  cash_expenses_cents INTEGER DEFAULT 0,
  bank_expenses_cents INTEGER DEFAULT 0,
  closing_balance_cents INTEGER DEFAULT 0,
  is_opening_balance_auto_calculated BOOLEAN DEFAULT FALSE,
  calculated_closing_balance_cents INTEGER DEFAULT 0,
  balance_discrepancy_cents INTEGER DEFAULT 0,
  created_by_user_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, org_id),
  UNIQUE(org_id, property_id, balance_date)
) PARTITION BY HASH (org_id);

-- Create 16 hash partitions for daily_cash_balances
CREATE TABLE IF NOT EXISTS daily_cash_balances_0 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 0);

CREATE TABLE IF NOT EXISTS daily_cash_balances_1 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 1);

CREATE TABLE IF NOT EXISTS daily_cash_balances_2 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 2);

CREATE TABLE IF NOT EXISTS daily_cash_balances_3 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 3);

CREATE TABLE IF NOT EXISTS daily_cash_balances_4 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 4);

CREATE TABLE IF NOT EXISTS daily_cash_balances_5 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 5);

CREATE TABLE IF NOT EXISTS daily_cash_balances_6 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 6);

CREATE TABLE IF NOT EXISTS daily_cash_balances_7 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 7);

CREATE TABLE IF NOT EXISTS daily_cash_balances_8 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 8);

CREATE TABLE IF NOT EXISTS daily_cash_balances_9 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 9);

CREATE TABLE IF NOT EXISTS daily_cash_balances_10 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 10);

CREATE TABLE IF NOT EXISTS daily_cash_balances_11 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 11);

CREATE TABLE IF NOT EXISTS daily_cash_balances_12 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 12);

CREATE TABLE IF NOT EXISTS daily_cash_balances_13 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 13);

CREATE TABLE IF NOT EXISTS daily_cash_balances_14 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 14);

CREATE TABLE IF NOT EXISTS daily_cash_balances_15 PARTITION OF daily_cash_balances_partitioned
  FOR VALUES WITH (modulus 16, remainder 15);

-- -------------------------------------------------------------------------
-- 2. REVENUES - Range Partitioning by occurred_at (Monthly, 12 partitions)
-- -------------------------------------------------------------------------

-- Create partitioned table for revenues
CREATE TABLE IF NOT EXISTS revenues_partitioned (
  id SERIAL,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  description TEXT,
  category VARCHAR(100),
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  approved_by_user_id INTEGER,
  approved_at TIMESTAMP,
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions for current year
CREATE TABLE IF NOT EXISTS revenues_2025_01 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS revenues_2025_02 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS revenues_2025_03 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS revenues_2025_04 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS revenues_2025_05 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS revenues_2025_06 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS revenues_2025_07 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS revenues_2025_08 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS revenues_2025_09 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS revenues_2025_10 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS revenues_2025_11 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS revenues_2025_12 PARTITION OF revenues_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- -------------------------------------------------------------------------
-- 3. EXPENSES - Range Partitioning by occurred_at (Monthly, 12 partitions)
-- -------------------------------------------------------------------------

-- Create partitioned table for expenses
CREATE TABLE IF NOT EXISTS expenses_partitioned (
  id SERIAL,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  description TEXT,
  category VARCHAR(100),
  payment_method VARCHAR(50),
  vendor_name VARCHAR(200),
  reference_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  approved_by_user_id INTEGER,
  approved_at TIMESTAMP,
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create monthly partitions for current year
CREATE TABLE IF NOT EXISTS expenses_2025_01 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS expenses_2025_02 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS expenses_2025_03 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS expenses_2025_04 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS expenses_2025_05 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS expenses_2025_06 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS expenses_2025_07 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS expenses_2025_08 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS expenses_2025_09 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS expenses_2025_10 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS expenses_2025_11 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS expenses_2025_12 PARTITION OF expenses_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- -------------------------------------------------------------------------
-- 4. SYNC TRIGGERS - Keep legacy and partitioned tables in sync
-- -------------------------------------------------------------------------

-- Trigger function to sync daily_cash_balances inserts to partitioned table
CREATE OR REPLACE FUNCTION sync_daily_cash_balances_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_cash_balances_partitioned (
    org_id, property_id, balance_date, opening_balance_cents,
    cash_received_cents, bank_received_cents, cash_expenses_cents,
    bank_expenses_cents, closing_balance_cents,
    is_opening_balance_auto_calculated, calculated_closing_balance_cents,
    balance_discrepancy_cents, created_by_user_id, created_at, updated_at
  ) VALUES (
    NEW.org_id, NEW.property_id, NEW.balance_date, NEW.opening_balance_cents,
    NEW.cash_received_cents, NEW.bank_received_cents, NEW.cash_expenses_cents,
    NEW.bank_expenses_cents, NEW.closing_balance_cents,
    NEW.is_opening_balance_auto_calculated, NEW.calculated_closing_balance_cents,
    NEW.balance_discrepancy_cents, NEW.created_by_user_id, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (org_id, property_id, balance_date) 
  DO UPDATE SET
    opening_balance_cents = EXCLUDED.opening_balance_cents,
    cash_received_cents = EXCLUDED.cash_received_cents,
    bank_received_cents = EXCLUDED.bank_received_cents,
    cash_expenses_cents = EXCLUDED.cash_expenses_cents,
    bank_expenses_cents = EXCLUDED.bank_expenses_cents,
    closing_balance_cents = EXCLUDED.closing_balance_cents,
    is_opening_balance_auto_calculated = EXCLUDED.is_opening_balance_auto_calculated,
    calculated_closing_balance_cents = EXCLUDED.calculated_closing_balance_cents,
    balance_discrepancy_cents = EXCLUDED.balance_discrepancy_cents,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on legacy table (only if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_cash_balances') THEN
    DROP TRIGGER IF EXISTS sync_to_partitioned_daily_cash_balances ON daily_cash_balances;
    CREATE TRIGGER sync_to_partitioned_daily_cash_balances
      AFTER INSERT OR UPDATE ON daily_cash_balances
      FOR EACH ROW EXECUTE FUNCTION sync_daily_cash_balances_insert();
  END IF;
END $$;

-- Trigger function to sync revenues inserts to partitioned table
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

-- Create trigger on legacy table (only if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
    DROP TRIGGER IF EXISTS sync_to_partitioned_revenues ON revenues;
    CREATE TRIGGER sync_to_partitioned_revenues
      AFTER INSERT OR UPDATE ON revenues
      FOR EACH ROW EXECUTE FUNCTION sync_revenues_insert();
  END IF;
END $$;

-- Trigger function to sync expenses inserts to partitioned table
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

-- Create trigger on legacy table (only if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    DROP TRIGGER IF EXISTS sync_to_partitioned_expenses ON expenses;
    CREATE TRIGGER sync_to_partitioned_expenses
      AFTER INSERT OR UPDATE ON expenses
      FOR EACH ROW EXECUTE FUNCTION sync_expenses_insert();
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 5. COMMENTS
-- -------------------------------------------------------------------------

COMMENT ON TABLE daily_cash_balances_partitioned IS 'Partitioned table for daily cash balances - Hash partitioning by org_id (16 partitions) for 1M+ organizations';
COMMENT ON TABLE revenues_partitioned IS 'Partitioned table for revenues - Range partitioning by occurred_at (monthly) for efficient time-based queries';
COMMENT ON TABLE expenses_partitioned IS 'Partitioned table for expenses - Range partitioning by occurred_at (monthly) for efficient time-based queries';

-- =========================================================================
-- MIGRATION COMPLETE
-- Next steps:
-- 1. Run add_performance_indexes.sql to add optimized indexes
-- 2. Backfill data from legacy tables if they exist
-- 3. Enable use_partitioned_tables feature flag in partitioning_manager.ts
-- 4. Set up monthly cron job to create next month's partitions
-- =========================================================================

