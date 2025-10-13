import { api } from "encore.dev/api";
import { guestCheckinDB } from "./db";
import log from "encore.dev/log";

interface VerifySchemaResponse {
  success: boolean;
  tables: {
    guest_checkins: boolean;
    guest_documents: boolean;
    guest_audit_logs: boolean;
  };
  indexes: {
    guest_documents_count: number;
    guest_audit_logs_count: number;
  };
  new_columns: {
    data_source: boolean;
    data_verified: boolean;
    verified_by_user_id: boolean;
    verified_at: boolean;
  };
  message: string;
}

// Verify database schema for migration testing
export const verifySchema = api(
  { expose: true, method: "GET", path: "/guest-checkin/verify-schema", auth: false },
  async (): Promise<VerifySchemaResponse> => {
    log.info("Verifying guest-checkin database schema");

    try {
      // Check tables exist
      const tables = await guestCheckinDB.queryAll`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name IN ('guest_checkins', 'guest_documents', 'guest_audit_logs')
      `;
      
      const tableNames = tables.map((t: any) => t.table_name);

      // Check new columns in guest_checkins
      const newColumns = await guestCheckinDB.queryAll`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'guest_checkins'
          AND column_name IN ('data_source', 'data_verified', 'verified_by_user_id', 'verified_at')
      `;
      
      const columnNames = newColumns.map((c: any) => c.column_name);

      // Count indexes
      const docIndexes = await guestCheckinDB.queryAll`
        SELECT indexname FROM pg_indexes WHERE tablename = 'guest_documents'
      `;
      
      const auditIndexes = await guestCheckinDB.queryAll`
        SELECT indexname FROM pg_indexes WHERE tablename = 'guest_audit_logs'
      `;

      const allTablesExist = 
        tableNames.includes('guest_checkins') &&
        tableNames.includes('guest_documents') &&
        tableNames.includes('guest_audit_logs');

      const allColumnsExist =
        columnNames.includes('data_source') &&
        columnNames.includes('data_verified') &&
        columnNames.includes('verified_by_user_id') &&
        columnNames.includes('verified_at');

      return {
        success: allTablesExist && allColumnsExist,
        tables: {
          guest_checkins: tableNames.includes('guest_checkins'),
          guest_documents: tableNames.includes('guest_documents'),
          guest_audit_logs: tableNames.includes('guest_audit_logs'),
        },
        indexes: {
          guest_documents_count: docIndexes.length,
          guest_audit_logs_count: auditIndexes.length,
        },
        new_columns: {
          data_source: columnNames.includes('data_source'),
          data_verified: columnNames.includes('data_verified'),
          verified_by_user_id: columnNames.includes('verified_by_user_id'),
          verified_at: columnNames.includes('verified_at'),
        },
        message: allTablesExist && allColumnsExist
          ? "✅ All migrations applied successfully!"
          : "❌ Migration verification failed - some tables or columns missing",
      };
    } catch (error: any) {
      log.error("Schema verification failed", { error });
      
      return {
        success: false,
        tables: {
          guest_checkins: false,
          guest_documents: false,
          guest_audit_logs: false,
        },
        indexes: {
          guest_documents_count: 0,
          guest_audit_logs_count: 0,
        },
        new_columns: {
          data_source: false,
          data_verified: false,
          verified_by_user_id: false,
          verified_at: false,
        },
        message: `❌ Error verifying schema: ${error.message}`,
      };
    }
  }
);

