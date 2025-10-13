import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
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

// Upload a file (receipt, document, etc.)
export const uploadFile = api<UploadRequest, UploadResponse>(
  { auth: true, expose: true, method: "POST", path: "/uploads/file" },
  async (req) => {
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
    
    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (fileBuffer.length > maxSize) {
      throw APIError.invalidArgument("File size too large. Maximum size is 50MB.");
    }

    // Generate unique filename
    const fileExtension = path.extname(req.filename) || getExtensionFromMimeType(req.mimeType);
    const uniqueFilename = `${randomUUID()}${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', authData.orgId.toString());
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save file to disk
    const filePath = path.join(uploadsDir, uniqueFilename);
    fs.writeFileSync(filePath, fileBuffer);

    // Save file info to database
    const fileRecord = await uploadsDB.queryRow`
      INSERT INTO files (org_id, filename, original_name, mime_type, file_size, file_path, uploaded_by_user_id)
      VALUES (${authData.orgId}, ${uniqueFilename}, ${req.filename}, ${req.mimeType}, ${fileBuffer.length}, ${filePath}, ${parseInt(authData.userID)})
      RETURNING id, filename
    `;

    if (!fileRecord) {
      // Clean up file if database insert failed
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Failed to clean up file:', error);
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

