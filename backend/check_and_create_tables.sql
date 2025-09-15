-- Check if tables exist and create them if they don't
-- This script will be run to ensure all required tables exist

-- Check and create notifications table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE notifications (
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
        
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX idx_notifications_org_id ON notifications(org_id);
        CREATE INDEX idx_notifications_is_read ON notifications(is_read);
        CREATE INDEX idx_notifications_created_at ON notifications(created_at);
        CREATE INDEX idx_notifications_type ON notifications(type);
        
        RAISE NOTICE 'Created notifications table';
    ELSE
        RAISE NOTICE 'notifications table already exists';
    END IF;
END $$;

-- Check and create approvals table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'approvals') THEN
        CREATE TABLE approvals (
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
        
        CREATE INDEX idx_approvals_org_id ON approvals(org_id);
        CREATE INDEX idx_approvals_requested_by_user_id ON approvals(requested_by_user_id);
        CREATE INDEX idx_approvals_approver_user_id ON approvals(approver_user_id);
        CREATE INDEX idx_approvals_status ON approvals(status);
        CREATE INDEX idx_approvals_entity_type ON approvals(entity_type);
        CREATE INDEX idx_approvals_entity_id ON approvals(entity_id);
        CREATE INDEX idx_approvals_requested_at ON approvals(requested_at);
        
        RAISE NOTICE 'Created approvals table';
    ELSE
        RAISE NOTICE 'approvals table already exists';
    END IF;
END $$;

-- Check and create task_attachments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_attachments') THEN
        CREATE TABLE task_attachments (
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
        
        CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
        CREATE INDEX idx_task_attachments_org_id ON task_attachments(org_id);
        CREATE INDEX idx_task_attachments_uploaded_by_user_id ON task_attachments(uploaded_by_user_id);
        CREATE INDEX idx_task_attachments_uploaded_at ON task_attachments(uploaded_at);
        CREATE INDEX idx_task_attachments_file_type ON task_attachments(file_type);
        
        RAISE NOTICE 'Created task_attachments table';
    ELSE
        RAISE NOTICE 'task_attachments table already exists';
    END IF;
END $$;

-- Show all tables to confirm
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

