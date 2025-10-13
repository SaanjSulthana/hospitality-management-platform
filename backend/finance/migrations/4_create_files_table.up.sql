-- Create files table only if it doesn't exist and required dependencies exist
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files') THEN
        
        CREATE TABLE files (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_size INTEGER NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            uploaded_by_user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            
            CONSTRAINT fk_files_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
            CONSTRAINT fk_files_uploaded_by_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
        );
        
        -- Create indexes for the files table
        CREATE INDEX IF NOT EXISTS idx_files_org_id ON files(org_id);
        CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_user_id ON files(uploaded_by_user_id);
        CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
    END IF;
END $$;
