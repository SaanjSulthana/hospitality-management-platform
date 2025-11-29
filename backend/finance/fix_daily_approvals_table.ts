import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface FixDailyApprovalsResponse {
  success: boolean;
  message: string;
}

// Fix daily approvals table
export const fixDailyApprovalsTable = api<{}, FixDailyApprovalsResponse>(
  { auth: false, expose: true, method: "POST", path: "/finance/fix-daily-approvals-table" },
  async () => {
    try {
      // Drop and recreate daily_approvals table with correct structure
      await financeDB.exec`DROP TABLE IF EXISTS daily_approvals`;
      
      await financeDB.exec`
        CREATE TABLE daily_approvals (
          id SERIAL PRIMARY KEY,
          org_id BIGINT NOT NULL,
          manager_user_id BIGINT NOT NULL,
          approval_date DATE NOT NULL,
          approved_by_admin_id BIGINT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(org_id, manager_user_id, approval_date)
        )
      `;

      return {
        success: true,
        message: "Daily approvals table recreated with correct structure"
      };

    } catch (error) {
      console.error('Fix daily approvals table error:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
);
