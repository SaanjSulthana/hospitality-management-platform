import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import { receiptsBucket } from "../storage/buckets";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export interface UploadRequest {
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

export interface UploadResponse {
  fileId: number;
  filename: string;
  url: string;
}

// Shared handler for uploading a file (receipt, document, etc.)
async function uploadFileHandler(req: UploadRequest): Promise<UploadResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(req.mimeType)) {
      throw APIError.invalidArgument("File type not supported. Please upload images (JPG, PNG, GIF, WebP) or PDF files.");
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(req.fileData, 'base64');
    
    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileBuffer.length > maxSize) {
      throw APIError.invalidArgument("File size too large. Maximum size is 100MB.");
    }

    // Generate unique filename
    const fileExtension = path.extname(req.filename) || getExtensionFromMimeType(req.mimeType);
    const uniqueFilename = `${randomUUID()}${fileExtension}`;
    
    // Upload to Encore Cloud bucket
    const bucketKey = `${authData.orgId}/${uniqueFilename}`;
    
    try {
      await receiptsBucket.upload(bucketKey, fileBuffer, {
        contentType: req.mimeType
      });
    } catch (error) {
      console.error('Failed to upload to bucket:', error);
      throw APIError.internal("Failed to upload file to cloud storage");
    }

    // Save file info to database with cloud storage marker
    const fileRecord = await uploadsDB.queryRow`
      INSERT INTO files (org_id, filename, original_name, mime_type, file_size, file_path, uploaded_by_user_id, storage_location, bucket_key)
      VALUES (${authData.orgId}, ${uniqueFilename}, ${req.filename}, ${req.mimeType}, ${fileBuffer.length}, '', ${parseInt(authData.userID)}, 'cloud', ${bucketKey})
      RETURNING id, filename
    `;

    if (!fileRecord) {
      // Clean up file from bucket if database insert failed
      try {
        await receiptsBucket.remove(bucketKey);
      } catch (error) {
        console.error('Failed to clean up file from bucket:', error);
      }
      throw APIError.internal("Failed to save file record");
    }

  // Return file info with access URL
  return {
    fileId: fileRecord.id,
    filename: fileRecord.filename,
    url: `/uploads/file/${fileRecord.id}`,
  };
}

// LEGACY: Upload a file (keep for backward compatibility)
export const uploadFile = api<UploadRequest, UploadResponse>(
  { auth: true, expose: true, method: "POST", path: "/uploads/file" },
  uploadFileHandler
);

// V1: Upload a file
export const uploadFileV1 = api<UploadRequest, UploadResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/uploads/file" },
  uploadFileHandler
);

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  };
  
  return mimeToExt[mimeType] || '';
}

