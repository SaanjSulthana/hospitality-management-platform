-- Create table to track daily approvals for managers
CREATE TABLE daily_approvals (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    manager_user_id INTEGER NOT NULL,
    approval_date DATE NOT NULL,
    approved_by_admin_id INTEGER NOT NULL,
    approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    
    CONSTRAINT fk_daily_approvals_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
    CONSTRAINT fk_daily_approvals_manager_user_id FOREIGN KEY (manager_user_id) REFERENCES users(id),
    CONSTRAINT fk_daily_approvals_approved_by_admin_id FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
    
    -- Ensure one approval per manager per day
    UNIQUE(org_id, manager_user_id, approval_date)
);

-- Index for efficient lookups
CREATE INDEX idx_daily_approvals_manager_date ON daily_approvals(org_id, manager_user_id, approval_date);
CREATE INDEX idx_daily_approvals_date ON daily_approvals(org_id, approval_date);
