import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import { financeDB } from "../finance/db";
import * as fs from "fs";
import * as path from "path";

export interface DeleteFileRequest {
  fileId: number;
}

export interface DeleteFileResponse {
  fileId: number;
  deleted: boolean;
  message: string;
}

// Delete a file (receipt, document, etc.)
export const deleteFile = api<DeleteFileRequest, DeleteFileResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/uploads/file/:fileId" },
  async (req) => {
    const { fileId } = req;
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Get file info and verify access
    const fileRecord = await uploadsDB.queryRow`
      SELECT f.id, f.filename, f.file_path, f.uploaded_by_user_id
      FROM files f
      WHERE f.id = ${fileId} AND f.org_id = ${authData.orgId}
    `;

    if (!fileRecord) {
      throw APIError.notFound("File not found or access denied");
    }

    // Check if user can delete this file
    // Admins can delete any file, managers can only delete their own files
    if (authData.role === "MANAGER" && fileRecord.uploaded_by_user_id !== parseInt(authData.userID)) {
      throw APIError.permissionDenied("You can only delete files you uploaded");
    }

    // Check if file is referenced by any transactions
    const revenueRefs = await financeDB.queryRow`
      SELECT COUNT(*) as count FROM revenues WHERE receipt_file_id = ${fileId} AND org_id = ${authData.orgId}
    `;
    
    const expenseRefs = await financeDB.queryRow`
      SELECT COUNT(*) as count FROM expenses WHERE receipt_file_id = ${fileId} AND org_id = ${authData.orgId}
    `;

    const totalRefs = (revenueRefs?.count || 0) + (expenseRefs?.count || 0);

    if (totalRefs > 0) {
      throw APIError.invalidArgument(
        `Cannot delete file. It is currently referenced by ${totalRefs} transaction(s). Please remove the file from all transactions first.`
      );
    }

    try {
      // Delete file from disk
      if (fs.existsSync(fileRecord.file_path)) {
        fs.unlinkSync(fileRecord.file_path);
      }

      // Delete file record from database
      await uploadsDB.exec`
        DELETE FROM files 
        WHERE id = ${fileId} AND org_id = ${authData.orgId}
      `;

      return {
        fileId,
        deleted: true,
        message: "File deleted successfully"
      };
    } catch (error: any) {
      console.error('Delete file error:', error);
      throw APIError.internal(`Failed to delete file: ${error.message}`);
    }
  }
);
