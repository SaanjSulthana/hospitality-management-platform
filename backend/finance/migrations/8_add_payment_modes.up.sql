-- Add payment modes and daily cash balance tracking
-- Migration 8: Add Payment Modes for Enhanced Financial Reporting

-- Add payment mode to revenues table (if table and column don't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'payment_mode') THEN
        ALTER TABLE revenues ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));
    END IF;
END $$;

-- Add bank reference for bank transactions in revenues (if table and column don't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'revenues' AND column_name = 'bank_reference') THEN
        ALTER TABLE revenues ADD COLUMN bank_reference VARCHAR(255);
    END IF;
END $$;

-- Add payment mode to expenses table (if table and column don't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'payment_mode') THEN
        ALTER TABLE expenses ADD COLUMN payment_mode VARCHAR(10) DEFAULT 'cash' NOT NULL CHECK (payment_mode IN ('cash', 'bank'));
    END IF;
END $$;

-- Add bank reference for bank transactions in expenses (if table and column don't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'bank_reference') THEN
        ALTER TABLE expenses ADD COLUMN bank_reference VARCHAR(255);
    END IF;
END $$;

-- Create daily cash balances table for tracking opening/closing balances (only if dependencies exist)
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_cash_balances') THEN
        
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

            -- Add foreign key constraints
            CONSTRAINT fk_daily_cash_balances_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
            CONSTRAINT fk_daily_cash_balances_property_id FOREIGN KEY (property_id) REFERENCES properties(id),
            CONSTRAINT fk_daily_cash_balances_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id),

            -- Ensure one balance record per property per day
            UNIQUE(org_id, property_id, balance_date)
        );
        
        -- Create indexes for daily_cash_balances table
        CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_org_id ON daily_cash_balances(org_id);
        CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_property_id ON daily_cash_balances(property_id);
        CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_date ON daily_cash_balances(balance_date);
        CREATE INDEX IF NOT EXISTS idx_daily_cash_balances_created_by ON daily_cash_balances(created_by_user_id);
    END IF;
END $$;