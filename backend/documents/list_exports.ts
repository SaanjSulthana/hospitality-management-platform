import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { documentsDB } from "./db";
import { ExportStatus, ExportType } from "./types";

export interface ListExportsRequest {
  status?: ExportStatus;
  exportType?: ExportType;
  limit?: number;
  offset?: number;
}

export interface ListExportsResponse {
  exports: Array<{
    exportId: string;
    exportType: ExportType;
    format: 'pdf' | 'xlsx';
    status: ExportStatus;
    fileSizeBytes?: number;
    createdAt: Date;
    expiresAt?: Date;
  }>;
  total: number;
  limit: number;
  offset: number;
}

/**
 * List user's exports with filtering and pagination
 */
async function listExportsHandler(req: ListExportsRequest): Promise<ListExportsResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const { status, exportType, limit = 20, offset = 0 } = req;

    // Validate and cap limit
    const validLimit = Math.min(Math.max(1, limit), 100);

    try {
      // Build query dynamically
      let query = `
        SELECT export_id, export_type, format, status, file_size_bytes, created_at, expires_at
        FROM document_exports
        WHERE org_id = $1 AND user_id = $2
      `;
      const params: any[] = [authData.orgId, parseInt(authData.userID)];
      let paramIndex = 3;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (exportType) {
        query += ` AND export_type = $${paramIndex}`;
        params.push(exportType);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(validLimit, offset);

      const exports = await documentsDB.query<{
        export_id: string;
        export_type: ExportType;
        format: 'pdf' | 'xlsx';
        status: ExportStatus;
        file_size_bytes: number | null;
        created_at: Date;
        expires_at: Date | null;
      }>(query, ...params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as count
        FROM document_exports
        WHERE org_id = $1 AND user_id = $2
      `;
      const countParams: any[] = [authData.orgId, parseInt(authData.userID)];
      let countParamIndex = 3;

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (exportType) {
        countQuery += ` AND export_type = $${countParamIndex}`;
        countParams.push(exportType);
      }

      const countResult = await documentsDB.queryRow<{ count: number }>(countQuery, ...countParams);
      const total = countResult?.count || 0;

    return {
      exports: exports.map(exp => ({
        exportId: exp.export_id,
        exportType: exp.export_type,
        format: exp.format,
        status: exp.status,
        fileSizeBytes: exp.file_size_bytes || undefined,
        createdAt: exp.created_at,
        expiresAt: exp.expires_at || undefined,
      })),
      total,
      limit: validLimit,
      offset,
    };
  } catch (error) {
    console.error('[Documents] List exports error:', error);
    throw APIError.internal(`Failed to list exports: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const listExports = api<ListExportsRequest, ListExportsResponse>(
  { auth: true, expose: true, method: "GET", path: "/documents/exports" },
  listExportsHandler
);

export const listExportsV1 = api<ListExportsRequest, ListExportsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/documents/exports" },
  listExportsHandler
);

