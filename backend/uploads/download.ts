import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import * as fs from "fs";

export interface DownloadRequest {
  fileId: number;
}

export interface DownloadResponse {
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

// Download/serve a file
export const downloadFile = api<DownloadRequest, DownloadResponse>(
  { auth: true, expose: true, method: "GET", path: "/uploads/:fileId/download" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Get file info from database
    const fileRecord = await uploadsDB.queryRow`
      SELECT f.filename, f.original_name, f.mime_type, f.file_path
      FROM files f
      WHERE f.id = ${req.fileId} AND f.org_id = ${authData.orgId}
    `;

    if (!fileRecord) {
      throw APIError.notFound("File not found or access denied");
    }

    // Check if file exists on disk
    if (!fs.existsSync(fileRecord.file_path)) {
      throw APIError.notFound("File not found on disk");
    }

    // Read file from disk
    const fileBuffer = fs.readFileSync(fileRecord.file_path);

    return {
      fileData: fileBuffer.toString('base64'),
      filename: fileRecord.original_name,
      mimeType: fileRecord.mime_type,
    };
  }
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

// Get file information without downloading
export const getFileInfo = api<GetFileInfoRequest, FileInfo>(
  { auth: true, expose: true, method: "GET", path: "/uploads/:fileId/info" },
  async (req) => {
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
);

