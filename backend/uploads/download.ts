import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import { receiptsBucket } from "../storage/buckets";
import * as fs from "fs";

export interface DownloadRequest {
  fileId: number;
}

export interface DownloadResponse {
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

// Shared handler for downloading/serving a file
async function downloadFileHandler(req: DownloadRequest): Promise<DownloadResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Get file info from database
    const fileRecord = await uploadsDB.queryRow`
      SELECT f.filename, f.original_name, f.mime_type, f.file_path, f.storage_location, f.bucket_key
      FROM files f
      WHERE f.id = ${req.fileId} AND f.org_id = ${authData.orgId}
    `;

    if (!fileRecord) {
      throw APIError.notFound("File not found or access denied");
    }

    let fileBuffer: Buffer;

    // Fetch from cloud or local storage
    if (fileRecord.storage_location === 'cloud' && fileRecord.bucket_key) {
      // Fetch from Encore bucket
      try {
        fileBuffer = await receiptsBucket.download(fileRecord.bucket_key);
      } catch (error) {
        console.error('Failed to download from bucket:', error);
        throw APIError.notFound("File not found in cloud storage");
      }
    } else {
      // Legacy: fetch from local disk
      if (!fs.existsSync(fileRecord.file_path)) {
        throw APIError.notFound("File not found on disk");
      }
      fileBuffer = fs.readFileSync(fileRecord.file_path);
    }

  return {
    fileData: fileBuffer.toString('base64'),
    filename: fileRecord.original_name,
    mimeType: fileRecord.mime_type,
  };
}

// LEGACY: Download/serve a file (keep for backward compatibility)
export const downloadFile = api<DownloadRequest, DownloadResponse>(
  { auth: true, expose: true, method: "GET", path: "/uploads/:fileId/download" },
  downloadFileHandler
);

// V1: Download/serve a file
export const downloadFileV1 = api<DownloadRequest, DownloadResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/uploads/:fileId/download" },
  downloadFileHandler
);

export interface GetFileInfoRequest {
  fileId: number;
}

export interface FileInfo {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
}

// Shared handler for getting file information without downloading
async function getFileInfoHandler(req: GetFileInfoRequest): Promise<FileInfo> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const fileRecord = await uploadsDB.queryRow`
      SELECT f.id, f.filename, f.original_name, f.mime_type, f.file_size, f.created_at,
             u.display_name as uploaded_by_name
      FROM files f
      JOIN users u ON f.uploaded_by_user_id = u.id
      WHERE f.id = ${req.fileId} AND f.org_id = ${authData.orgId}
    `;

    if (!fileRecord) {
      throw APIError.notFound("File not found or access denied");
    }

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    originalName: fileRecord.original_name,
    mimeType: fileRecord.mime_type,
    fileSize: fileRecord.file_size,
    uploadedAt: fileRecord.created_at,
    uploadedBy: fileRecord.uploaded_by_name,
  };
}

// LEGACY: Get file information (keep for backward compatibility)
export const getFileInfo = api<GetFileInfoRequest, FileInfo>(
  { auth: true, expose: true, method: "GET", path: "/uploads/:fileId/info" },
  getFileInfoHandler
);

// V1: Get file information
export const getFileInfoV1 = api<GetFileInfoRequest, FileInfo>(
  { auth: true, expose: true, method: "GET", path: "/v1/uploads/:fileId/info" },
  getFileInfoHandler
);

