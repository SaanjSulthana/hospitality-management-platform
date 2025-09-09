import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Ensure daily_approvals table exists with correct schema
export const ensureDailyApprovalsTable = api(
  { auth: true, expose: true, method: "POST", path: "/finance/ensure-daily-approvals-table" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const tx = await financeDB.begin();
    try {
      console.log("Ensuring daily_approvals table exists...");
      
      // Check if daily_approvals table exists
      const tableExists = await tx.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'daily_approvals'
        )
      `;
      
      if (!tableExists?.exists) {
        console.log("Creating daily_approvals table...");
        
        // Create daily_approvals table
        await tx.exec`
          CREATE TABLE daily_approvals (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL,
            manager_user_id INTEGER NOT NULL,
            approval_date DATE NOT NULL,
            approved_by_admin_id INTEGER NOT NULL,
            approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
            notes TEXT,
            
            CONSTRAINT fk_daily_approvals_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
            CONSTRAINT fk_daily_approvals_manager_user_id FOREIGN KEY (manager_user_id) REFERENCES users(id),
            CONSTRAINT fk_daily_approvals_approved_by_admin_id FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
            
            -- Ensure one approval per manager per day
            UNIQUE(org_id, manager_user_id, approval_date)
          )
        `;
        
        // Create indexes
        await tx.exec`CREATE INDEX idx_daily_approvals_manager_date ON daily_approvals(org_id, manager_user_id, approval_date)`;
        await tx.exec`CREATE INDEX idx_daily_approvals_date ON daily_approvals(org_id, approval_date)`;
        
        console.log("Daily approvals table created successfully!");
      } else {
        console.log("Daily approvals table already exists");
      }
      
      // Check table schema
      const schema = await tx.queryAll`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'daily_approvals'
        ORDER BY ordinal_position
      `;
      
      await tx.commit();
      
      return { 
        message: "Daily approvals table ensured", 
        tableExists: tableExists?.exists || false,
        schema: schema
      };
    } catch (error) {
      await tx.rollback();
      console.error('Ensure daily approvals table error:', error);
      throw APIError.internal(`Failed to ensure daily approvals table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
