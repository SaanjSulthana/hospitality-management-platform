-- Create daily_cash_balances table in reports/hospitality database
CREATE TABLE IF NOT EXISTS daily_cash_balances (
  id SERIAL PRIMARY KEY,
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
  
  UNIQUE(org_id, property_id, balance_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_org_date 
  ON daily_cash_balances(org_id, balance_date DESC);
  
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_property_date 
  ON daily_cash_balances(property_id, balance_date DESC);
  
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_lookup
  ON daily_cash_balances(org_id, property_id, balance_date DESC);

-- Add comment
COMMENT ON TABLE daily_cash_balances IS 'Daily cash balance records for financial reporting';
