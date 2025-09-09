import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { uploadsDB } from "./db";

export const setupFilesTable = api(
  { auth: true, expose: true, method: "POST", path: "/uploads/setup-files-table" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw new Error("Authentication required");
    }

    try {
      console.log("Setting up files table...");
      
      // Check if files table exists
      const tableExists = await uploadsDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'files'
        )
      `;
      
      if (!tableExists?.exists) {
        console.log("Creating files table...");
        
        // Create files table
        await uploadsDB.exec`
          CREATE TABLE files (
            id BIGSERIAL PRIMARY KEY,
            org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_size BIGINT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        
        // Create indexes
        await uploadsDB.exec`CREATE INDEX idx_files_org_id ON files(org_id)`;
        await uploadsDB.exec`CREATE INDEX idx_files_uploaded_by ON files(uploaded_by_user_id)`;
        await uploadsDB.exec`CREATE INDEX idx_files_created_at ON files(created_at)`;
        await uploadsDB.exec`CREATE INDEX idx_files_mime_type ON files(mime_type)`;
        
        console.log("Files table created successfully!");
      } else {
        console.log("Files table already exists");
      }
      
      // Check table schema
      const schema = await uploadsDB.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'files'
        ORDER BY ordinal_position
      `;
      
      return { 
        message: "Files table ensured", 
        tableExists: tableExists?.exists || false,
        schema: schema
      };
    } catch (error) {
      console.error('Files table setup error:', error);
      throw new Error(`Failed to setup files table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
