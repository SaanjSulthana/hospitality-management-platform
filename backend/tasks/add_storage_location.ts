import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { tasksDB } from "./db";
import { requireRole } from "../auth/middleware";

/**
 * Add storage_location and bucket_key columns to task_attachments table
 * This enables hybrid storage: existing files on local disk, new files in Encore buckets
 */
export const addStorageLocationColumns = api(
  { auth: true, expose: true, method: "POST", path: "/tasks/add-storage-location-columns" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await tasksDB.begin();
    try {
      console.log("Adding storage_location columns to task_attachments...");
      
      // Check if columns already exist
      const storageLocationExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'task_attachments' 
          AND column_name = 'storage_location'
        )
      `;
      
      if (!storageLocationExists?.exists) {
        console.log("Adding storage_location column...");
        
        // Add storage_location column
        await tx.exec`
          ALTER TABLE task_attachments 
          ADD COLUMN storage_location VARCHAR(20) DEFAULT 'local' CHECK (storage_location IN ('local', 'cloud'))
        `;
        
        // Add bucket_key column
        await tx.exec`
          ALTER TABLE task_attachments
          ADD COLUMN bucket_key VARCHAR(500)
        `;
        
        // Add index for efficient filtering
        await tx.exec`
          CREATE INDEX idx_task_attachments_storage_location ON task_attachments(storage_location)
        `;
        
        // Update existing records to be marked as 'local'
        await tx.exec`
          UPDATE task_attachments SET storage_location = 'local' WHERE storage_location IS NULL
        `;
        
        console.log("Storage location columns added successfully!");
      } else {
        console.log("Storage location columns already exist");
      }
      
      // Check updated schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'task_attachments'
        ORDER BY ordinal_position
      `;
      
      await tx.commit();
      
      return { 
        message: "Storage location columns ensured", 
        columnsAdded: !storageLocationExists?.exists,
        schema: schema
      };
    } catch (error) {
      await tx.rollback();
      console.error('Add storage location columns error:', error);
      throw APIError.internal(`Failed to add storage location columns: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


