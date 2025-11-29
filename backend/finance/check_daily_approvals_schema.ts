import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";

export interface DailyApprovalsSchemaResponse {
  success: boolean;
  tableExists: boolean;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>;
  sampleData: any[];
}

// Check daily_approvals table schema and data
export const checkDailyApprovalsSchema = api<{}, DailyApprovalsSchemaResponse>(
  { auth: false, expose: true, method: "GET", path: "/finance/check-daily-approvals-schema" },
  async () => {
    try {
      // Check if table exists
      const tableExists = await financeDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'daily_approvals'
        ) as exists
      `;

      if (!tableExists?.exists) {
        return {
          success: false,
          tableExists: false,
          columns: [],
          sampleData: []
        };
      }

      // Get all columns
      const columns = await financeDB.queryAll`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'daily_approvals'
        ORDER BY ordinal_position
      `;

      // Get sample data
      const sampleData = await financeDB.queryAll`
        SELECT * FROM daily_approvals LIMIT 5
      `;

      return {
        success: true,
        tableExists: true,
        columns: columns.map((col: any) => ({
          column_name: col.column_name,
          data_type: col.data_type,
          is_nullable: col.is_nullable,
          column_default: col.column_default
        })),
        sampleData
      };

    } catch (error) {
      console.error('Daily approvals schema check error:', error);
      return {
        success: false,
        tableExists: false,
        columns: [],
        sampleData: []
      };
    }
  }
);
