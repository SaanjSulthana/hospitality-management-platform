import { api, APIError } from "encore.dev/api";
import { uploadsDB } from "./db";

export interface CheckFilesTableResponse {
  success: boolean;
  message: string;
  tableExists: boolean;
  tableCreated: boolean;
}

// Shared handler to check and create files table
async function checkFilesTableHandler(): Promise<CheckFilesTableResponse> {
    try {
      // Check if files table exists
      const tableExists = await uploadsDB.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'files'
        )
      `;

      if (tableExists?.exists) {
        return {
          success: true,
          message: "Files table already exists",
          tableExists: true,
          tableCreated: false
        };
      }

      // Create files table
      await uploadsDB.exec`
        CREATE TABLE files (
          id BIGSERIAL PRIMARY KEY,
          org_id BIGINT NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size BIGINT NOT NULL,
          file_path TEXT NOT NULL,
          uploaded_by_user_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Create indexes
      await uploadsDB.exec`
        CREATE INDEX idx_files_org_id ON files(org_id)
      `;
      await uploadsDB.exec`
        CREATE INDEX idx_files_uploaded_by ON files(uploaded_by_user_id)
      `;
      await uploadsDB.exec`
        CREATE INDEX idx_files_created_at ON files(created_at)
      `;
      await uploadsDB.exec`
        CREATE INDEX idx_files_mime_type ON files(mime_type)
      `;

      return {
        success: true,
        message: "Files table created successfully",
        tableExists: false,
        tableCreated: true
      };
    } catch (error: any) {
      console.error('Check files table error:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      tableExists: false,
      tableCreated: false
    };
  }
}

// LEGACY: API endpoint to check and create files table (keep for backward compatibility)
export const checkFilesTable = api<{}, CheckFilesTableResponse>(
  { auth: false, expose: true, method: "GET", path: "/uploads/check-files-table" },
  checkFilesTableHandler
);

// V1: API endpoint to check and create files table
export const checkFilesTableV1 = api<{}, CheckFilesTableResponse>(
  { auth: false, expose: true, method: "GET", path: "/v1/uploads/check-files-table" },
  checkFilesTableHandler
);

