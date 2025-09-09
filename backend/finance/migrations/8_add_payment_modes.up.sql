-- Add payment modes and daily cash balance tracking
-- Migration 8: Add Payment Modes for Enhanced Financial Reporting

-- Add payment mode to revenues table
ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));

-- Add bank reference for bank transactions in revenues
ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255);

-- Add payment mode to expenses table  
ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));

-- Add bank reference for bank transactions in expenses
ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255);

-- Create daily cash balances table for tracking opening/closing balances
CREATE TABLE daily_cash_balances (
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
    
    -- Ensure one balance record per property per day
    UNIQUE(org_id, property_id, balance_date)
);

-- Create indexes for efficient querying
CREATE INDEX idx_daily_cash_balances_org_date ON daily_cash_balances(org_id, balance_date);
CREATE INDEX idx_daily_cash_balances_property_date ON daily_cash_balances(property_id, balance_date);
CREATE INDEX idx_revenues_payment_mode ON revenues(org_id, payment_mode);
CREATE INDEX idx_expenses_payment_mode ON expenses(org_id, payment_mode);

-- Update existing revenues to default cash payment mode
UPDATE revenues SET payment_mode = 'cash' WHERE payment_mode IS NULL;

-- Update existing expenses to default cash payment mode  
UPDATE expenses SET payment_mode = 'cash' WHERE payment_mode IS NULL;

-- Create a view for daily financial summary
CREATE OR REPLACE VIEW daily_financial_summary AS
SELECT 
    dcb.org_id,
    dcb.property_id,
    p.name as property_name,
    dcb.balance_date,
    dcb.opening_balance_cents,
    dcb.cash_received_cents,
    dcb.bank_received_cents,
    (dcb.cash_received_cents + dcb.bank_received_cents) as total_received_cents,
    dcb.cash_expenses_cents,
    dcb.bank_expenses_cents,
    (dcb.cash_expenses_cents + dcb.bank_expenses_cents) as total_expenses_cents,
    dcb.closing_balance_cents,
    (dcb.opening_balance_cents + dcb.cash_received_cents - dcb.cash_expenses_cents) as calculated_closing_balance_cents,
    dcb.created_at,
    dcb.updated_at
FROM daily_cash_balances dcb
JOIN properties p ON dcb.property_id = p.id
ORDER BY dcb.balance_date DESC, p.name;

