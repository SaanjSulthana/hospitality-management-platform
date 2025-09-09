-- Setup files table for uploads service
-- Run this in the Encore database shell

-- Check if files table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'files'
) as files_exists;

-- Create files table if it doesn't exist
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

-- Verify table was created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'files'
ORDER BY table_name;

-- Show table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'files'
ORDER BY ordinal_position;
