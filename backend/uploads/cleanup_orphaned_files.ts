import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import { financeDB } from "../finance/db";
import * as fs from "fs";
import * as path from "path";

export interface CleanupOrphanedFilesResponse {
  filesDeleted: number;
  filesChecked: number;
  errors: string[];
  message: string;
}

// Clean up orphaned files (files not referenced by any transactions)
export const cleanupOrphanedFiles = api<{}, CleanupOrphanedFilesResponse>(
  { auth: true, expose: true, method: "POST", path: "/uploads/cleanup-orphaned" },
  async () => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData); // Only admins can run cleanup

    let filesDeleted = 0;
    let filesChecked = 0;
    const errors: string[] = [];

    try {
      // Get all files for this organization
      const files = await uploadsDB.query`
        SELECT f.id, f.filename, f.file_path
        FROM files f
        WHERE f.org_id = ${authData.orgId}
        ORDER BY f.created_at ASC
      `;

      filesChecked = files.length;

      for (const file of files) {
        try {
          // Check if file is referenced by any transactions
          const revenueRefs = await financeDB.queryRow`
            SELECT COUNT(*) as count FROM revenues WHERE receipt_file_id = ${file.id} AND org_id = ${authData.orgId}
          `;
          
          const expenseRefs = await financeDB.queryRow`
            SELECT COUNT(*) as count FROM expenses WHERE receipt_file_id = ${file.id} AND org_id = ${authData.orgId}
          `;

          const totalRefs = (revenueRefs?.count || 0) + (expenseRefs?.count || 0);

          // If file is not referenced by any transactions, it's orphaned
          if (totalRefs === 0) {
            // Delete file from disk
            if (fs.existsSync(file.file_path)) {
              fs.unlinkSync(file.file_path);
            }

            // Delete file record from database
            await uploadsDB.exec`
              DELETE FROM files 
              WHERE id = ${file.id} AND org_id = ${authData.orgId}
            `;

            filesDeleted++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to process file ${file.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        filesDeleted,
        filesChecked,
        errors,
        message: `Cleanup completed. Deleted ${filesDeleted} orphaned files out of ${filesChecked} checked.`
      };
    } catch (error: any) {
      console.error('Cleanup orphaned files error:', error);
      throw APIError.internal(`Failed to cleanup orphaned files: ${error.message}`);
    }
  }
);
