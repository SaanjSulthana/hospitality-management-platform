-- Create expense deletion requests table (only if dependencies exist)
CREATE TABLE IF NOT EXISTS expense_deletion_requests (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    expense_id INTEGER NOT NULL,
    requested_by_user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by_user_id INTEGER,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create revenue deletion requests table (only if dependencies exist)
CREATE TABLE IF NOT EXISTS revenue_deletion_requests (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    revenue_id INTEGER NOT NULL,
    requested_by_user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    source VARCHAR(20) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by_user_id INTEGER,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expense_deletion_requests_org_id ON expense_deletion_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_expense_deletion_requests_status ON expense_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_deletion_requests_requested_by ON expense_deletion_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_deletion_requests_org_id ON revenue_deletion_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_deletion_requests_status ON revenue_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_revenue_deletion_requests_requested_by ON revenue_deletion_requests(requested_by_user_id);

-- Add foreign key constraints only if the referenced tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'expense_deletion_requests' AND constraint_name = 'fk_expense_deletion_requests_org_id') THEN
        ALTER TABLE expense_deletion_requests ADD CONSTRAINT fk_expense_deletion_requests_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'expense_deletion_requests' AND constraint_name = 'fk_expense_deletion_requests_expense_id') THEN
        ALTER TABLE expense_deletion_requests ADD CONSTRAINT fk_expense_deletion_requests_expense_id FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'expense_deletion_requests' AND constraint_name = 'fk_expense_deletion_requests_requested_by') THEN
        ALTER TABLE expense_deletion_requests ADD CONSTRAINT fk_expense_deletion_requests_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'expense_deletion_requests' AND constraint_name = 'fk_expense_deletion_requests_approved_by') THEN
        ALTER TABLE expense_deletion_requests ADD CONSTRAINT fk_expense_deletion_requests_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'revenue_deletion_requests' AND constraint_name = 'fk_revenue_deletion_requests_org_id') THEN
        ALTER TABLE revenue_deletion_requests ADD CONSTRAINT fk_revenue_deletion_requests_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'revenue_deletion_requests' AND constraint_name = 'fk_revenue_deletion_requests_revenue_id') THEN
        ALTER TABLE revenue_deletion_requests ADD CONSTRAINT fk_revenue_deletion_requests_revenue_id FOREIGN KEY (revenue_id) REFERENCES revenues(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'revenue_deletion_requests' AND constraint_name = 'fk_revenue_deletion_requests_requested_by') THEN
        ALTER TABLE revenue_deletion_requests ADD CONSTRAINT fk_revenue_deletion_requests_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'revenue_deletion_requests' AND constraint_name = 'fk_revenue_deletion_requests_approved_by') THEN
        ALTER TABLE revenue_deletion_requests ADD CONSTRAINT fk_revenue_deletion_requests_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_expense_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_revenue_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_update_expense_deletion_requests_updated_at') THEN
        CREATE TRIGGER trigger_update_expense_deletion_requests_updated_at
            BEFORE UPDATE ON expense_deletion_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_expense_deletion_requests_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_update_revenue_deletion_requests_updated_at') THEN
        CREATE TRIGGER trigger_update_revenue_deletion_requests_updated_at
            BEFORE UPDATE ON revenue_deletion_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_revenue_deletion_requests_updated_at();
    END IF;
END $$;