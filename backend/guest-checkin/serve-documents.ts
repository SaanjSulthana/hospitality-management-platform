/**
 * Document Serving Endpoints
 * Endpoints for viewing and downloading guest documents with signed URL access
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import log from "encore.dev/log";
import * as fs from "fs";
import { fileExists } from "./image-processor";

interface ViewDocumentRequest {
  documentId: number;
  token?: string;
}

interface ThumbnailRequest {
  documentId: number;
  token?: string;
}

interface DownloadDocumentRequest {
  documentId: number;
}

/**
 * View document image (returns binary image data)
 * Note: This is a simplified version. In production, you'd want to:
 * 1. Generate signed URLs with JWT
 * 2. Stream files instead of loading into memory
 * 3. Add caching headers
 */
export const viewDocument = api(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/view", auth: true },
  async ({ documentId }: ViewDocumentRequest): Promise<{ url: string; mimeType: string }> => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Viewing document", { documentId, userId: authData.userID });

    try {
      // Get document info
      const document = await guestCheckinDB.queryRow`
        SELECT id, file_path, mime_type, filename
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      // Check if file exists
      if (!fileExists(document.file_path)) {
        throw APIError.notFound("Document file not found on disk");
      }

      // For now, return file path info
      // In production, this would return signed URL or stream file
      return {
        url: `/uploads/guest-documents/${document.filename}`,
        mimeType: document.mime_type,
      };
    } catch (error: any) {
      log.error("Failed to view document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to view document");
    }
  }
);

/**
 * Get document thumbnail
 */
export const getDocumentThumbnail = api(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/thumbnail", auth: true },
  async ({ documentId }: ThumbnailRequest): Promise<{ url: string }> => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const document = await guestCheckinDB.queryRow`
        SELECT thumbnail_path
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      if (!document.thumbnail_path || !fileExists(document.thumbnail_path)) {
        throw APIError.notFound("Thumbnail not found");
      }

      // Return thumbnail info
      return {
        url: document.thumbnail_path,
      };
    } catch (error: any) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to get thumbnail");
    }
  }
);

/**
 * Download document (triggers audit log)
 */
export const downloadDocument = api(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/download", auth: true },
  async ({ documentId }: DownloadDocumentRequest): Promise<{ filename: string; filePath: string; mimeType: string }> => {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Downloading document", { documentId, userId: authData.userID });

    try {
      const document = await guestCheckinDB.queryRow`
        SELECT id, file_path, filename, mime_type
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      if (!fileExists(document.file_path)) {
        throw APIError.notFound("Document file not found on disk");
      }

      // TODO: Log download action in audit_logs

      return {
        filename: document.filename,
        filePath: document.file_path,
        mimeType: document.mime_type,
      };
    } catch (error: any) {
      log.error("Failed to download document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to download document");
    }
  }
);

