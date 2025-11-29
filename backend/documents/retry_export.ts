import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { documentsDB } from "./db";

export interface RetryExportRequest {
  exportId: string;
}

export interface RetryExportResponse {
  exportId: string;
  status: 'queued';
  retryCount: number;
  createdAt: Date;
}

/**
 * Retry a failed export job (ADMIN only)
 */
async function retryExportHandler(req: RetryExportRequest): Promise<RetryExportResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { exportId } = req;

    try {
      const exportRecord = await documentsDB.queryRow<{
        org_id: number;
        status: string;
        retry_count: number;
        created_at: Date;
      }>`
        SELECT org_id, status, retry_count, created_at
        FROM document_exports
        WHERE export_id = ${exportId}
      `;

      if (!exportRecord) {
        throw APIError.notFound("Export not found");
      }

      if (exportRecord.org_id !== authData.orgId) {
        throw APIError.permissionDenied("Access denied");
      }

      if (exportRecord.status !== 'failed') {
        throw APIError.invalidArgument(`Export is not in failed state (status: ${exportRecord.status})`);
      }

      if (exportRecord.retry_count >= 3) {
        throw APIError.resourceExhausted("Maximum retry attempts exceeded");
      }

      // Update export to queued status
      await documentsDB.exec`
        UPDATE document_exports
        SET status = 'queued',
            retry_count = retry_count + 1,
            error_message = NULL,
            updated_at = NOW()
        WHERE export_id = ${exportId}
      `;

      console.log(`[Documents] Export retry queued: ${exportId} (attempt ${exportRecord.retry_count + 1})`);

    return {
      exportId,
      status: 'queued',
      retryCount: exportRecord.retry_count + 1,
      createdAt: exportRecord.created_at,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    console.error('[Documents] Retry export error:', error);
    throw APIError.internal(`Failed to retry export: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const retryExport = api<RetryExportRequest, RetryExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/documents/exports/:exportId/retry" },
  retryExportHandler
);

export const retryExportV1 = api<RetryExportRequest, RetryExportResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/documents/exports/:exportId/retry" },
  retryExportHandler
);

