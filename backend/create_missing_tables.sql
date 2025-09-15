-- Create missing tables for hospitality management system
-- Run this script in the database shell: \i create_missing_tables.sql

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    org_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_org_id FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- 2. Create approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL,
    requested_by_user_id BIGINT NOT NULL,
    approver_user_id BIGINT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    request_reason TEXT,
    approval_notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_approvals_org_id FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT fk_approvals_requested_by_user_id FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_approvals_approver_user_id FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_approvals_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_approvals_entity_type CHECK (entity_type IN ('expense', 'revenue', 'task', 'staff', 'property', 'user'))
);

-- Create indexes for approvals
CREATE INDEX IF NOT EXISTS idx_approvals_org_id ON approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by_user_id ON approvals(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_user_id ON approvals(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_entity_type ON approvals(entity_type);
CREATE INDEX IF NOT EXISTS idx_approvals_entity_id ON approvals(entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_at ON approvals(requested_at);

-- 3. Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    org_id BIGINT NOT NULL,
    uploaded_by_user_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_task_attachments_task_id FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_attachments_org_id FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_attachments_uploaded_by_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_task_attachments_file_size CHECK (file_size > 0),
    CONSTRAINT chk_task_attachments_file_name CHECK (LENGTH(file_name) > 0)
);

-- Create indexes for task_attachments
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_org_id ON task_attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by_user_id ON task_attachments(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_at ON task_attachments(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_task_attachments_file_type ON task_attachments(file_type);

-- Show all tables to confirm creation
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Show success message
SELECT 'All required tables created successfully!' as status;

