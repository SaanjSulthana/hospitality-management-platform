import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { documentsDB } from "./db";
import { ExportType, ExportFormat, ExportMetadata } from "./types";

export interface CreateExportRequest {
  exportType: ExportType;
  format: ExportFormat;
  data: Record<string, any>;
  templateOverride?: string;
}

export interface CreateExportResponse {
  exportId: string;
  status: 'queued';
  estimatedSeconds: number;
  createdAt: Date;
}

/**
 * Create a new document export job
 * Queues the export for processing and returns exportId for status tracking
 */
async function createExportHandler(req: CreateExportRequest): Promise<CreateExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { exportType, format, data, templateOverride } = req;

    // Validate export type and format
    const validExportTypes: ExportType[] = [
      'daily-report', 'monthly-report', 'yearly-report',
      'staff-leave', 'staff-attendance', 'staff-salary'
    ];
    
    if (!validExportTypes.includes(exportType)) {
      throw APIError.invalidArgument(`Invalid exportType: ${exportType}`);
    }

    if (!['pdf', 'xlsx'].includes(format)) {
      throw APIError.invalidArgument(`Invalid format: ${format}`);
    }

    // Check queue capacity (max 50 pending exports per org)
    const queueCount = await documentsDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM document_exports
      WHERE org_id = ${authData.orgId} 
      AND status IN ('queued', 'processing')
    `;

    if ((queueCount?.count || 0) >= 50) {
      throw APIError.resourceExhausted("Export queue full. Please try again later.");
    }

    try {
      // Create export record
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      const metadata: ExportMetadata = {
        orgId: authData.orgId,
        userId: parseInt(authData.userID),
        generatedAt: new Date(),
        ...data, // Include all request data for retry
      };

      if (templateOverride) {
        metadata.templateName = templateOverride;
      }

      const exportRecord = await documentsDB.queryRow<{
        export_id: string;
        created_at: Date;
      }>`
        INSERT INTO document_exports (
          org_id, user_id, export_type, format, status,
          storage_location, expires_at, metadata, created_at, updated_at
        ) VALUES (
          ${authData.orgId}, ${parseInt(authData.userID)}, ${exportType}, ${format}, 'queued',
          'cloud', ${expiresAt}, ${JSON.stringify(metadata)}, NOW(), NOW()
        )
        RETURNING export_id, created_at
      `;

      if (!exportRecord) {
        throw new Error("Failed to create export record");
      }

      // TODO: Trigger async processing (pub/sub or background worker)
      // For now, we'll process synchronously in a separate endpoint
      console.log(`[Documents] Export queued: ${exportRecord.export_id} (${exportType} ${format})`);

      // Estimate processing time based on export type
      const estimatedSeconds = format === 'pdf' ? 3 : 2;

    return {
      exportId: exportRecord.export_id,
      status: 'queued',
      estimatedSeconds,
      createdAt: exportRecord.created_at,
    };
  } catch (error) {
    console.error('[Documents] Create export error:', error);
    throw APIError.internal(`Failed to create export: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const createExport = api<CreateExportRequest, CreateExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/documents/exports/create" },
  createExportHandler
);

export const createExportV1 = api<CreateExportRequest, CreateExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/documents/exports/create" },
  createExportHandler
);

