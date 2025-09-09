import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { requireRole } from "../auth/middleware";

// Ensure task_attachments table exists with correct schema
export const setupTaskAttachmentsTable = api(
  { auth: true, expose: true, method: "POST", path: "/tasks/setup-attachments-table" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await tasksDB.begin();
    try {
      console.log("Ensuring task_attachments table exists...");
      
      // Check if task_attachments table exists
      const tableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'task_attachments'
        )
      `;
      
      if (!tableExists?.exists) {
        console.log("Creating task_attachments table...");
        
        // Create task_attachments table
        await tx.exec`
          CREATE TABLE task_attachments (
            id BIGSERIAL PRIMARY KEY,
            org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_size BIGINT,
            mime_type TEXT,
            uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        
        // Create indexes
        await tx.exec`CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id)`;
        await tx.exec`CREATE INDEX idx_task_attachments_org_id ON task_attachments(org_id)`;
        await tx.exec`CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by_user_id)`;
        await tx.exec`CREATE INDEX idx_task_attachments_created_at ON task_attachments(created_at)`;
        
        console.log("Task attachments table created successfully!");
      } else {
        console.log("Task attachments table already exists");
      }
      
      // Check table schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'task_attachments'
        ORDER BY ordinal_position
      `;
      
      await tx.commit();
      
      return { 
        message: "Task attachments table ensured", 
        tableExists: tableExists?.exists || false,
        schema: schema
      };
    } catch (error) {
      await tx.rollback();
      console.error('Setup task attachments table error:', error);
      throw APIError.internal(`Failed to setup task attachments table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
