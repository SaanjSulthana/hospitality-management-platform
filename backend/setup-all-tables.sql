-- Comprehensive database setup for uploads and task attachments
-- Run this in the Encore database shell

-- Check existing tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('files', 'task_attachments', 'tasks', 'users', 'organizations')
ORDER BY table_name;

-- Create files table if it doesn't exist (for general file uploads)
CREATE TABLE IF NOT EXISTS files (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for files table
CREATE INDEX IF NOT EXISTS idx_files_org_id ON files(org_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);

-- Create task_attachments table if it doesn't exist (for task images)
CREATE TABLE IF NOT EXISTS task_attachments (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for task_attachments table
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_org_id ON task_attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON task_attachments(created_at);

-- Verify all tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('files', 'task_attachments', 'tasks', 'users', 'organizations')
ORDER BY table_name;

-- Show schemas for both tables
SELECT 'files' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'files'
UNION ALL
SELECT 'task_attachments' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'task_attachments'
ORDER BY table_name, column_name;
