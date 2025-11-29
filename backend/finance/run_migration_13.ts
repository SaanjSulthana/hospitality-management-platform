import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";
import { readFileSync } from "fs";
import { join } from "path";

export const runMigration13 = api(
  { auth: true, expose: true, method: "POST", path: "/finance/run-migration-13" },
  async () => {
    const authData = getAuthData();
    if (!authData) throw APIError.unauthenticated("Authentication required");
    requireRole("ADMIN")(authData);

    try {
      // Create the table directly
      await financeDB.exec`
        CREATE TABLE IF NOT EXISTS finance_event_store (
          id SERIAL PRIMARY KEY,
          event_id UUID NOT NULL UNIQUE,
          event_version VARCHAR(10) NOT NULL DEFAULT 'v1',
          event_type VARCHAR(50) NOT NULL,
          
          org_id INTEGER NOT NULL,
          property_id INTEGER,
          user_id INTEGER NOT NULL,
          
          entity_id INTEGER NOT NULL,
          entity_type VARCHAR(30) NOT NULL,
          event_payload JSONB NOT NULL,
          
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          correlation_id UUID,
          
          CONSTRAINT fk_event_store_org FOREIGN KEY (org_id) REFERENCES organizations(id),
          CONSTRAINT fk_event_store_user FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;
      
      // Create indexes
      await financeDB.exec`CREATE INDEX IF NOT EXISTS idx_event_store_org_property ON finance_event_store(org_id, property_id)`;
      await financeDB.exec`CREATE INDEX IF NOT EXISTS idx_event_store_entity ON finance_event_store(entity_type, entity_id)`;
      await financeDB.exec`CREATE INDEX IF NOT EXISTS idx_event_store_type ON finance_event_store(event_type)`;
      await financeDB.exec`CREATE INDEX IF NOT EXISTS idx_event_store_timestamp ON finance_event_store(created_at DESC)`;
      
      // Verify
      const result = await financeDB.queryRow`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'finance_event_store'
      `;
      
      return { 
        success: true, 
        message: "Migration 13 applied successfully",
        tableExists: result.count > 0
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message,
        hint: "Table may already exist (this is OK)"
      };
    }
  }
);
