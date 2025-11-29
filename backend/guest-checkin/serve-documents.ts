/**
 * Document Serving Endpoints
 * Endpoints for viewing and downloading guest documents with signed URL access
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { guestCheckinDB } from "./db";
import { guestDocumentsBucket } from "../storage/buckets";
import log from "encore.dev/log";
import * as fs from "fs";
import { fileExists } from "./image-processor";
import { v1Path } from "../shared/http";

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
 * View document image (returns base64-encoded file data for display)
 * Returns the actual file data encoded in base64 format for direct image display
 * Supports both cloud storage (Encore bucket) and local disk storage
 */
async function viewDocumentHandler({ documentId }: ViewDocumentRequest): Promise<{ filename: string; mimeType: string; fileData: string }> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Viewing document", { documentId, userId: authData.userID });

    try {
      // Get document info including storage location
      const document = await guestCheckinDB.queryRow`
        SELECT id, file_path, mime_type, filename, original_filename, storage_location, bucket_key
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      let fileBuffer: Buffer;

      // Handle different storage locations
      if (document.storage_location === 'cloud' && document.bucket_key) {
        // Download from Encore bucket
        try {
          log.info("Downloading from cloud storage", { 
            documentId, 
            bucketKey: document.bucket_key 
          });
          
          // Encore bucket.download() returns a Buffer directly
          fileBuffer = await guestDocumentsBucket.download(document.bucket_key);
          
          log.info("Downloaded from cloud successfully", { 
            documentId, 
            sizeBytes: fileBuffer.length 
          });
        } catch (bucketError: any) {
          log.error("Failed to download from cloud storage", { 
            error: bucketError.message, 
            documentId,
            bucketKey: document.bucket_key 
          });
          throw APIError.internal("Failed to download document from cloud storage");
        }
      } else {
        // Read from local disk (legacy documents)
      if (!fileExists(document.file_path)) {
          log.error("Document file not found on disk", {
            documentId,
            filePath: document.file_path,
            storageLocation: document.storage_location
          });
        throw APIError.notFound("Document file not found on disk");
      }

        try {
          log.info("Reading from local disk", { 
            documentId, 
            filePath: document.file_path 
          });
          
          fileBuffer = fs.readFileSync(document.file_path);
          
          log.info("Read from disk successfully", { 
            documentId, 
            sizeBytes: fileBuffer.length 
          });
        } catch (readError: any) {
          log.error("Failed to read document file from disk", { 
            error: readError.message, 
            documentId,
            filePath: document.file_path 
          });
          throw APIError.internal("Failed to read document file");
        }
      }

      // Convert to base64
      const base64Data = fileBuffer.toString('base64');
      
      log.info("Document loaded successfully", { 
        documentId, 
        filename: document.filename,
        storageLocation: document.storage_location,
        sizeBytes: fileBuffer.length 
      });

      return {
        filename: document.original_filename || document.filename,
        mimeType: document.mime_type,
        fileData: base64Data,
      };
    } catch (error: any) {
      log.error("Failed to view document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to view document");
    }
  }

export const viewDocument = api<ViewDocumentRequest, { filename: string; mimeType: string; fileData: string }>(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/view", auth: true },
  viewDocumentHandler
);

export const viewDocumentV1 = api<ViewDocumentRequest, { filename: string; mimeType: string; fileData: string }>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/documents/:documentId/view", auth: true },
  viewDocumentHandler
);

/**
 * Get document thumbnail
 */
async function getDocumentThumbnailHandler({ documentId }: ThumbnailRequest): Promise<{ url: string }> {
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

export const getDocumentThumbnail = api<ThumbnailRequest, { url: string }>(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/thumbnail", auth: true },
  getDocumentThumbnailHandler
);

export const getDocumentThumbnailV1 = api<ThumbnailRequest, { url: string }>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/documents/:documentId/thumbnail", auth: true },
  getDocumentThumbnailHandler
);

/**
 * Download document (returns base64-encoded file data for download)
 * Triggers audit log for compliance tracking
 * Supports both cloud storage (Encore bucket) and local disk storage
 */
async function downloadDocumentHandler({ documentId }: DownloadDocumentRequest): Promise<{ filename: string; mimeType: string; fileData: string }> {
    const authData = getAuthData()!;
    requireRole("ADMIN", "MANAGER")(authData);

    log.info("Downloading document", { documentId, userId: authData.userID });

    try {
      const document = await guestCheckinDB.queryRow`
        SELECT id, file_path, filename, original_filename, mime_type, storage_location, bucket_key
        FROM guest_documents
        WHERE id = ${documentId} AND org_id = ${authData.orgId} AND deleted_at IS NULL
      `;

      if (!document) {
        throw APIError.notFound("Document not found");
      }

      let fileBuffer: Buffer;

      // Handle different storage locations
      if (document.storage_location === 'cloud' && document.bucket_key) {
        // Download from Encore bucket
        try {
          log.info("Downloading document from cloud storage", { 
            documentId, 
            bucketKey: document.bucket_key 
          });
          
          // Encore bucket.download() returns a Buffer directly
          fileBuffer = await guestDocumentsBucket.download(document.bucket_key);
          
          log.info("Downloaded from cloud successfully for download", { 
            documentId, 
            sizeBytes: fileBuffer.length 
          });
        } catch (bucketError: any) {
          log.error("Failed to download from cloud storage", { 
            error: bucketError.message, 
            documentId,
            bucketKey: document.bucket_key 
          });
          throw APIError.internal("Failed to download document from cloud storage");
        }
      } else {
        // Read from local disk (legacy documents)
      if (!fileExists(document.file_path)) {
          log.error("Document file not found on disk for download", {
            documentId,
            filePath: document.file_path,
            storageLocation: document.storage_location
          });
        throw APIError.notFound("Document file not found on disk");
      }

        try {
          log.info("Reading document from local disk for download", { 
            documentId, 
            filePath: document.file_path 
          });
          
          fileBuffer = fs.readFileSync(document.file_path);
          
          log.info("Read from disk successfully for download", { 
            documentId, 
            sizeBytes: fileBuffer.length 
          });
        } catch (readError: any) {
          log.error("Failed to read document file from disk for download", { 
            error: readError.message, 
            documentId,
            filePath: document.file_path 
          });
          throw APIError.internal("Failed to read document file");
        }
      }

      // Convert to base64
      const base64Data = fileBuffer.toString('base64');
      
      log.info("Document downloaded successfully", { 
        documentId, 
        filename: document.filename,
        storageLocation: document.storage_location,
        userId: authData.userID,
        sizeBytes: fileBuffer.length 
      });

      // TODO: Log download action in audit_logs

      return {
        filename: document.original_filename || document.filename,
        mimeType: document.mime_type,
        fileData: base64Data,
      };
    } catch (error: any) {
      log.error("Failed to download document", { error: error.message, documentId });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to download document");
    }
  }

export const downloadDocument = api<DownloadDocumentRequest, { filename: string; mimeType: string; fileData: string }>(
  { expose: true, method: "GET", path: "/guest-checkin/documents/:documentId/download", auth: true },
  downloadDocumentHandler
);

export const downloadDocumentV1 = api<DownloadDocumentRequest, { filename: string; mimeType: string; fileData: string }>(
  { expose: true, method: "GET", path: "/v1/guest-checkin/documents/:documentId/download", auth: true },
  downloadDocumentHandler
);

