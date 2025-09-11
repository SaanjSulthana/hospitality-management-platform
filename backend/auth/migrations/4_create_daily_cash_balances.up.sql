-- Migration 4: Create daily_cash_balances table

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
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_daily_cash_balances_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT fk_daily_cash_balances_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
  CONSTRAINT fk_daily_cash_balances_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  
  UNIQUE(org_id, property_id, balance_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_org_date ON daily_cash_balances(org_id, balance_date);
CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_property_date ON daily_cash_balances(property_id, balance_date);
