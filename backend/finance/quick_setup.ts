import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

// Quick setup endpoint that can be called without authentication for initial setup
export const quickSetup = api(
  { auth: false, expose: true, method: "POST", path: "/finance/quick-setup" },
  async () => {
    try {
      console.log("Starting quick database setup...");
      
      const tx = await financeDB.begin();
      const results = {
        notifications: { created: false, exists: false },
        dailyApprovals: { created: false, exists: false },
        errors: [] as string[]
      };
      
      // 1. Check and create notifications table
      try {
        const notificationsExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'notifications'
          )
        `;
        
        if (!notificationsExists?.exists) {
          console.log("Creating notifications table...");
          
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
          
          results.notifications.created = true;
          console.log("Notifications table created successfully!");
        } else {
          results.notifications.exists = true;
          console.log("Notifications table already exists");
        }
      } catch (error) {
        results.errors.push(`Notifications table error: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Notifications table error:', error);
      }
      
      // 2. Check and create daily_approvals table
      try {
        const dailyApprovalsExists = await tx.queryRow`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'daily_approvals'
          )
        `;
        
        if (!dailyApprovalsExists?.exists) {
          console.log("Creating daily_approvals table...");
          
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
          
          results.dailyApprovals.created = true;
          console.log("Daily approvals table created successfully!");
        } else {
          results.dailyApprovals.exists = true;
          console.log("Daily approvals table already exists");
        }
      } catch (error) {
        results.errors.push(`Daily approvals table error: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Daily approvals table error:', error);
      }
      
      // 3. Verify all required tables exist
      const requiredTables = ['notifications', 'daily_approvals', 'expenses', 'revenues', 'users', 'organizations'];
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
        message: "Quick database setup completed",
        results,
        tableStatus,
        success: results.errors.length === 0
      };
    } catch (error) {
      console.error('Quick setup error:', error);
      throw APIError.internal(`Quick setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
