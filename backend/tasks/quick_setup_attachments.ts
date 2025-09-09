import { api, APIError } from "encore.dev/api";
import { tasksDB } from "./db";

// Quick setup endpoint that can be called without authentication for initial setup
export const quickSetupAttachments = api(
  { auth: false, expose: true, method: "POST", path: "/tasks/quick-setup-attachments" },
  async () => {
    try {
      console.log("Starting quick task attachments setup...");
      
      const tx = await tasksDB.begin();
      const results = {
        taskAttachments: { created: false, exists: false },
        errors: [] as string[]
      };
      
      // Check and create task_attachments table
      try {
        const taskAttachmentsExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'task_attachments'
          )
        `;
        
        if (!taskAttachmentsExists?.exists) {
          console.log("Creating task_attachments table...");
          
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
          
          results.taskAttachments.created = true;
          console.log("Task attachments table created successfully!");
        } else {
          results.taskAttachments.exists = true;
          console.log("Task attachments table already exists");
        }
      } catch (error) {
        results.errors.push(`Task attachments table error: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Task attachments table error:', error);
      }
      
      // Verify all required tables exist
      const requiredTables = ['task_attachments', 'tasks', 'users', 'organizations'];
      const tableStatus = [];
      
      for (const tableName of requiredTables) {
        try {
          const exists = await tx.queryRow`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = ${tableName}
            )
          `;
          tableStatus.push({ table: tableName, exists: exists?.exists || false });
        } catch (error) {
          tableStatus.push({ table: tableName, exists: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      await tx.commit();
      
      return { 
        message: "Quick task attachments setup completed",
        results,
        tableStatus,
        success: results.errors.length === 0
      };
    } catch (error) {
      console.error('Quick setup attachments error:', error);
      throw APIError.internal(`Quick setup attachments failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
