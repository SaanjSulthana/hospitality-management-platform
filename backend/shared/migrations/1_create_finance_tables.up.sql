-- Create finance tables in shared database for cross-service access
-- This allows reports service to access revenues and expenses tables

-- Create revenues table
CREATE TABLE IF NOT EXISTS revenues (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cash', 'bank')),
  bank_reference VARCHAR(255),
  description TEXT,
  source VARCHAR(100),
  occurred_at TIMESTAMP NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  property_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cash', 'bank')),
  bank_reference VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  expense_date DATE NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenues_org_property ON revenues(org_id, property_id);
CREATE INDEX IF NOT EXISTS idx_revenues_occurred_at ON revenues(occurred_at);
CREATE INDEX IF NOT EXISTS idx_revenues_status ON revenues(status);

CREATE INDEX IF NOT EXISTS idx_expenses_org_property ON expenses(org_id, property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
