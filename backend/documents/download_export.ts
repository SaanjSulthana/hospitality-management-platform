import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { documentsDB } from "./db";
import { documentExportsBucket } from "../storage/buckets";

export interface DownloadExportRequest {
  exportId: string;
}

/**
 * Download generated document by streaming from bucket
 * Returns the file data as base64 for now (Encore raw mode has limitations)
 */
async function downloadExportHandler(req: DownloadExportRequest): Promise<{ data: string; filename: string; mimeType: string }> {
  const { exportId } = req;
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
  try {
      const exportRecord = await documentsDB.queryRow<{
        org_id: number;
        user_id: number;
        export_type: string;
        format: string;
        status: string;
        bucket_key: string | null;
        file_size_bytes: number | null;
        expires_at: Date | null;
        metadata: any;
      }>`
        SELECT org_id, user_id, export_type, format, status, bucket_key, file_size_bytes, expires_at, metadata
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

      // Check if export is ready
      if (exportRecord.status !== 'ready') {
        throw APIError.failedPrecondition(`Export not ready (status: ${exportRecord.status})`);
      }

      // Check if expired
      if (exportRecord.expires_at && exportRecord.expires_at < new Date()) {
        throw APIError.notFound("Export has expired");
      }

      if (!exportRecord.bucket_key) {
        throw APIError.internal("Export file not found in storage");
      }

      // Download file from bucket
      console.log(`[Documents] Downloading from bucket: ${exportRecord.bucket_key}`);
      const fileBuffer = await documentExportsBucket.download(exportRecord.bucket_key);
      
      console.log(`[Documents] Downloaded ${fileBuffer.length} bytes for export ${exportId}`);
      
      // Generate filename with org and property names
      const extension = exportRecord.format;
      // Parse metadata if it's a string (PostgreSQL JSON)
      const metadata = typeof exportRecord.metadata === 'string' 
        ? JSON.parse(exportRecord.metadata) 
        : (exportRecord.metadata || {});
      
      console.log('[Documents] Metadata for filename:', metadata);
      
      const orgName = metadata.orgName || 'Organization';
      const propertyName = metadata.propertyName || 'Property';
      const date = metadata.date || new Date().toISOString().split('T')[0];
      
      // Clean names for filename (remove special characters and spaces)
      const cleanOrgName = orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const cleanPropertyName = propertyName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      
      const filename = `${exportRecord.export_type}_${cleanOrgName}_${cleanPropertyName}_${date}.${extension}`;
      const mimeType = exportRecord.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
    // Return as base64 (Encore's raw mode has issues with binary data)
    return {
      data: fileBuffer.toString('base64'),
      filename,
      mimeType,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('[Documents] Download export error:', error);
    throw APIError.internal(`Failed to download export: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const downloadExport = api<DownloadExportRequest, { data: string; filename: string; mimeType: string }>(
  { auth: true, expose: true, method: "GET", path: "/documents/exports/:exportId/download" },
  downloadExportHandler
);

export const downloadExportV1 = api<DownloadExportRequest, { data: string; filename: string; mimeType: string }>(
  { auth: true, expose: true, method: "GET", path: "/v1/documents/exports/:exportId/download" },
  downloadExportHandler
);

