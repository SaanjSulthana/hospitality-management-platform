-- Create approvals table for approval workflows
CREATE TABLE IF NOT EXISTS approvals (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL,
    requested_by_user_id BIGINT NOT NULL,
    approver_user_id BIGINT,
    entity_type VARCHAR(50) NOT NULL, -- 'expense', 'revenue', 'task', 'staff', etc.
    entity_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    request_reason TEXT,
    approval_notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_approvals_org_id FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT fk_approvals_requested_by_user_id FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_approvals_approver_user_id FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT chk_approvals_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_approvals_entity_type CHECK (entity_type IN ('expense', 'revenue', 'task', 'staff', 'property', 'user'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_approvals_org_id ON approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by_user_id ON approvals(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_user_id ON approvals(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_entity_type ON approvals(entity_type);
CREATE INDEX IF NOT EXISTS idx_approvals_entity_id ON approvals(entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_at ON approvals(requested_at);

-- Add comments for documentation
COMMENT ON TABLE approvals IS 'Approval workflows for various entities in the system';
COMMENT ON COLUMN approvals.entity_type IS 'Type of entity being approved: expense, revenue, task, staff, property, user';
COMMENT ON COLUMN approvals.entity_id IS 'ID of the entity being approved';
COMMENT ON COLUMN approvals.status IS 'Approval status: pending, approved, rejected';
COMMENT ON COLUMN approvals.request_reason IS 'Reason for the approval request';
COMMENT ON COLUMN approvals.approval_notes IS 'Notes from the approver';

