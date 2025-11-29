import { api } from "encore.dev/api";
import { financeDB } from "./db";

export interface AddPerformanceIndexesResponse {
  success: boolean;
  message: string;
  indexesCreated: string[];
}

// Add performance indexes for faster queries
export const addPerformanceIndexes = api<{}, AddPerformanceIndexesResponse>(
  { auth: false, expose: true, method: "POST", path: "/finance/add-performance-indexes" },
  async () => {
    try {
      const indexesCreated: string[] = [];

      // Add indexes for expenses table
      const expenseIndexes = [
        {
          name: "idx_expenses_org_id",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_org_id ON expenses (org_id)"
        },
        {
          name: "idx_expenses_property_id",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_property_id ON expenses (property_id)"
        },
        {
          name: "idx_expenses_created_at",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses (created_at DESC)"
        },
        {
          name: "idx_expenses_status",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status)"
        },
        {
          name: "idx_expenses_org_property",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_org_property ON expenses (org_id, property_id)"
        },
        {
          name: "idx_expenses_org_status",
          query: "CREATE INDEX IF NOT EXISTS idx_expenses_org_status ON expenses (org_id, status)"
        }
      ];

      for (const index of expenseIndexes) {
        await financeDB.exec(index.query);
        indexesCreated.push(index.name);
      }

      // Add indexes for revenues table
      const revenueIndexes = [
        {
          name: "idx_revenues_org_id",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_org_id ON revenues (org_id)"
        },
        {
          name: "idx_revenues_property_id",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_property_id ON revenues (property_id)"
        },
        {
          name: "idx_revenues_created_at",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_created_at ON revenues (created_at DESC)"
        },
        {
          name: "idx_revenues_status",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_status ON revenues (status)"
        },
        {
          name: "idx_revenues_org_property",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_org_property ON revenues (org_id, property_id)"
        },
        {
          name: "idx_revenues_org_status",
          query: "CREATE INDEX IF NOT EXISTS idx_revenues_org_status ON revenues (org_id, status)"
        }
      ];

      for (const index of revenueIndexes) {
        await financeDB.exec(index.query);
        indexesCreated.push(index.name);
      }

      // Add indexes for daily_approvals table
      const approvalIndexes = [
        {
          name: "idx_daily_approvals_org_manager",
          query: "CREATE INDEX IF NOT EXISTS idx_daily_approvals_org_manager ON daily_approvals (org_id, manager_user_id)"
        },
        {
          name: "idx_daily_approvals_date",
          query: "CREATE INDEX IF NOT EXISTS idx_daily_approvals_date ON daily_approvals (approval_date)"
        }
      ];

      for (const index of approvalIndexes) {
        await financeDB.exec(index.query);
        indexesCreated.push(index.name);
      }

      return {
        success: true,
        message: `Successfully created ${indexesCreated.length} performance indexes`,
        indexesCreated
      };

    } catch (error) {
      console.error('Add performance indexes error:', error);
      return {
        success: false,
        message: `Error creating indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        indexesCreated: []
      };
    }
  }
);
