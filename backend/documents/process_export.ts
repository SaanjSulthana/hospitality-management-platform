/**
 * Export Processor
 * Handles the async processing of export jobs
 */

import { api, APIError } from "encore.dev/api";
import { documentsDB } from "./db";
import { documentExportsBucket } from "../storage/buckets";
import { render } from "./renderer";
import { RenderContext, ExportType, ExportFormat } from "./types";

export interface ProcessExportRequest {
  exportId: string;
}

export interface ProcessExportResponse {
  exportId: string;
  status: 'ready' | 'failed';
  fileSizeBytes?: number;
  errorMessage?: string;
}

/**
 * Process a queued export job
 * This endpoint is called internally to render and store the export
 */
export const processExport = api<ProcessExportRequest, ProcessExportResponse>(
  { auth: false, expose: false, method: "POST", path: "/documents/exports/:exportId/process" },
  async (req) => {
    const { exportId } = req;
    
    try {
      // Get export record
      const exportRecord = await documentsDB.queryRow<{
        id: number;
        org_id: number;
        export_type: ExportType;
        format: ExportFormat;
        status: string;
        metadata: any;
      }>`
        SELECT id, org_id, export_type, format, status, metadata
        FROM document_exports
        WHERE export_id = ${exportId}
      `;

      if (!exportRecord) {
        throw new Error('Export not found');
      }

      if (exportRecord.status !== 'queued') {
        throw new Error(`Export not in queued state: ${exportRecord.status}`);
      }

      // Update status to processing
      await documentsDB.exec`
        UPDATE document_exports
        SET status = 'processing', updated_at = NOW()
        WHERE export_id = ${exportId}
      `;

      console.log(`[ProcessExport] Processing export: ${exportId}`);

      // Parse metadata
      const metadata = typeof exportRecord.metadata === 'string' 
        ? JSON.parse(exportRecord.metadata) 
        : exportRecord.metadata;

      // Create render context
      const context: RenderContext = {
        exportType: exportRecord.export_type,
        format: exportRecord.format,
        data: metadata,
        metadata,
      };

      // Render document
      const result = await render(context);

      // Upload to bucket
      const bucketKey = `${exportRecord.org_id}/exports/${exportId}.${exportRecord.format}`;
      
      await documentExportsBucket.upload(bucketKey, result.buffer, {
        contentType: result.mimeType,
      });

      console.log(`[ProcessExport] Uploaded to bucket: ${bucketKey}`);

      // Update export record to ready
      await documentsDB.exec`
        UPDATE document_exports
        SET status = 'ready',
            bucket_key = ${bucketKey},
            file_size_bytes = ${result.fileSizeBytes},
            completed_at = NOW(),
            updated_at = NOW()
        WHERE export_id = ${exportId}
      `;

      console.log(`[ProcessExport] Export completed: ${exportId}`);

      return {
        exportId,
        status: 'ready',
        fileSizeBytes: result.fileSizeBytes,
      };
    } catch (error) {
      console.error(`[ProcessExport] Failed to process export ${exportId}:`, error);

      // Update export record to failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await documentsDB.exec`
        UPDATE document_exports
        SET status = 'failed',
            error_message = ${errorMessage},
            updated_at = NOW()
        WHERE export_id = ${exportId}
      `;

      return {
        exportId,
        status: 'failed',
        errorMessage,
      };
    }
  }
);

