import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { documentsDB } from "./db";
import { documentExportsBucket } from "../storage/buckets";

export interface DeleteExportRequest {
  exportId: string;
}

export interface DeleteExportResponse {
  exportId: string;
  deletedAt: Date;
  message: string;
}

/**
 * Manually delete an export before expiration
 */
async function deleteExportHandler(req: DeleteExportRequest): Promise<DeleteExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { exportId } = req;

    try {
      const exportRecord = await documentsDB.queryRow<{
        org_id: number;
        user_id: number;
        bucket_key: string | null;
        storage_location: string;
      }>`
        SELECT org_id, user_id, bucket_key, storage_location
        FROM document_exports
        WHERE export_id = ${exportId}
      `;

      if (!exportRecord) {
        throw APIError.notFound("Export not found");
      }

      // Check permissions
      if (exportRecord.org_id !== authData.orgId) {
        throw APIError.permissionDenied("Access denied");
      }

      if (exportRecord.user_id !== parseInt(authData.userID) && authData.role !== "ADMIN") {
        throw APIError.permissionDenied("You don't own this export");
      }

      // Delete from bucket if exists
      if (exportRecord.bucket_key && exportRecord.storage_location === 'cloud') {
        try {
          await documentExportsBucket.remove(exportRecord.bucket_key);
          console.log(`[Documents] Deleted from bucket: ${exportRecord.bucket_key}`);
        } catch (error) {
          console.error('[Documents] Failed to delete from bucket:', error);
          // Continue with database deletion even if bucket deletion fails
        }
      }

      // Delete from database
      await documentsDB.exec`
        DELETE FROM document_exports
        WHERE export_id = ${exportId}
      `;

      const deletedAt = new Date();
      console.log(`[Documents] Export deleted: ${exportId}`);

    return {
      exportId,
      deletedAt,
      message: 'Export deleted successfully',
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('[Documents] Delete export error:', error);
    throw APIError.internal(`Failed to delete export: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const deleteExport = api<DeleteExportRequest, DeleteExportResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/documents/exports/:exportId" },
  deleteExportHandler
);

export const deleteExportV1 = api<DeleteExportRequest, DeleteExportResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/v1/documents/exports/:exportId" },
  deleteExportHandler
);

