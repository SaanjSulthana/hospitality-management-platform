import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { documentsDB } from "./db";
import { ExportStatus } from "./types";

export interface GetExportStatusRequest {
  exportId: string;
}

export interface GetExportStatusResponse {
  exportId: string;
  status: ExportStatus;
  progress?: number;
  downloadUrl?: string;
  fileSizeBytes?: number;
  expiresAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get export job status and download information
 */
async function getExportStatusHandler(req: GetExportStatusRequest): Promise<GetExportStatusResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { exportId } = req;

    try {
      const exportRecord = await documentsDB.queryRow<{
        export_id: string;
        org_id: number;
        user_id: number;
        status: ExportStatus;
        bucket_key: string | null;
        file_size_bytes: number | null;
        expires_at: Date | null;
        error_message: string | null;
        created_at: Date;
        updated_at: Date;
      }>`
        SELECT export_id, org_id, user_id, status, bucket_key, 
               file_size_bytes, expires_at, error_message,
               created_at, updated_at
        FROM document_exports
        WHERE export_id = ${exportId}
      `;

      if (!exportRecord) {
        throw APIError.notFound("Export not found");
      }

      // Check if user owns export or is admin
      if (exportRecord.org_id !== authData.orgId) {
        throw APIError.permissionDenied("Access denied");
      }

      if (exportRecord.user_id !== parseInt(authData.userID) && authData.role !== "ADMIN") {
        throw APIError.permissionDenied("You don't own this export");
      }

      const response: GetExportStatusResponse = {
        exportId: exportRecord.export_id,
        status: exportRecord.status,
        createdAt: exportRecord.created_at,
        updatedAt: exportRecord.updated_at,
      };

      // Add download URL if ready
      if (exportRecord.status === 'ready' && exportRecord.bucket_key) {
        response.downloadUrl = `/documents/exports/${exportId}/download`;
        response.fileSizeBytes = exportRecord.file_size_bytes || undefined;
        response.expiresAt = exportRecord.expires_at || undefined;
      }

      // Add progress estimate for processing state
      if (exportRecord.status === 'processing') {
        // Simple progress estimate based on time elapsed
        const elapsed = Date.now() - exportRecord.created_at.getTime();
        const estimatedTotal = 3000; // 3 seconds average
        response.progress = Math.min(95, Math.floor((elapsed / estimatedTotal) * 100));
      }

      // Add error message if failed
      if (exportRecord.status === 'failed') {
        response.errorMessage = exportRecord.error_message || 'Export generation failed';
      }

    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('[Documents] Get export status error:', error);
    throw APIError.internal(`Failed to get export status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const getExportStatus = api<GetExportStatusRequest, GetExportStatusResponse>(
  { auth: true, expose: true, method: "GET", path: "/documents/exports/:exportId/status" },
  getExportStatusHandler
);

export const getExportStatusV1 = api<GetExportStatusRequest, GetExportStatusResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/documents/exports/:exportId/status" },
  getExportStatusHandler
);

