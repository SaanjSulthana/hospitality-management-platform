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
