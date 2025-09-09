import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Ensure notifications table exists with correct schema
export const ensureNotificationsTable = api(
  { auth: true, expose: true, method: "POST", path: "/finance/ensure-notifications-table" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await financeDB.begin();
    try {
      console.log("Ensuring notifications table exists...");
      
      // Check if notifications table exists
      const tableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )
      `;
      
      if (!tableExists?.exists) {
        console.log("Creating notifications table...");
        
        // Create notifications table
        await tx.exec`
          CREATE TABLE notifications (
            id BIGSERIAL PRIMARY KEY,
            org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            payload_json JSONB DEFAULT '{}',
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `;
        
        // Create indexes
        await tx.exec`CREATE INDEX idx_notifications_org_user ON notifications(org_id, user_id)`;
        await tx.exec`CREATE INDEX idx_notifications_type ON notifications(type)`;
        await tx.exec`CREATE INDEX idx_notifications_created_at ON notifications(created_at)`;
        await tx.exec`CREATE INDEX idx_notifications_read_at ON notifications(read_at)`;
        
        console.log("Notifications table created successfully!");
      } else {
        console.log("Notifications table already exists");
      }
      
      // Check table schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'notifications'
        ORDER BY ordinal_position
      `;
      
      await tx.commit();
      
      return { 
        message: "Notifications table ensured", 
        tableExists: tableExists?.exists || false,
        schema: schema
      };
    } catch (error) {
      await tx.rollback();
      console.error('Ensure notifications table error:', error);
      throw APIError.internal(`Failed to ensure notifications table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
