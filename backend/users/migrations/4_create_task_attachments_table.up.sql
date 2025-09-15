-- Create task_attachments table for file attachments on tasks
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
    
    -- Foreign key constraints
    CONSTRAINT fk_task_attachments_task_id FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_attachments_org_id FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_attachments_uploaded_by_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT chk_task_attachments_file_size CHECK (file_size > 0),
    CONSTRAINT chk_task_attachments_file_name CHECK (LENGTH(file_name) > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_org_id ON task_attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by_user_id ON task_attachments(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_at ON task_attachments(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_task_attachments_file_type ON task_attachments(file_type);

-- Add comments for documentation
COMMENT ON TABLE task_attachments IS 'File attachments for tasks';
COMMENT ON COLUMN task_attachments.file_path IS 'Server path to the uploaded file';
COMMENT ON COLUMN task_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN task_attachments.file_type IS 'File extension/type (e.g., pdf, jpg, doc)';
COMMENT ON COLUMN task_attachments.mime_type IS 'MIME type of the file (e.g., application/pdf, image/jpeg)';
COMMENT ON COLUMN task_attachments.description IS 'Optional description of the attachment';

