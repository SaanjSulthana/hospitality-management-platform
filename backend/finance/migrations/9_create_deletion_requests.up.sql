-- Create expense deletion requests table
CREATE TABLE IF NOT EXISTS expense_deletion_requests (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create revenue deletion requests table
CREATE TABLE IF NOT EXISTS revenue_deletion_requests (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    revenue_id INTEGER NOT NULL REFERENCES revenues(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    source VARCHAR(20) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

-- Add updated_at trigger for expense_deletion_requests
CREATE OR REPLACE FUNCTION update_expense_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_expense_deletion_requests_updated_at
    BEFORE UPDATE ON expense_deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_expense_deletion_requests_updated_at();

-- Add updated_at trigger for revenue_deletion_requests
CREATE OR REPLACE FUNCTION update_revenue_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_revenue_deletion_requests_updated_at
    BEFORE UPDATE ON revenue_deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_revenue_deletion_requests_updated_at();
