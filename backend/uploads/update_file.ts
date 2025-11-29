import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { uploadsDB } from "./db";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export interface UpdateFileRequest {
  fileId: number;
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

export interface UpdateFileResponse {
  fileId: number;
  filename: string;
  url: string;
  message: string;
}

// Shared handler for updating/replacing a file (receipt, document, etc.)
async function updateFileHandler(req: UpdateFileRequest): Promise<UpdateFileResponse> {
    const { fileId, fileData, filename, mimeType } = req;
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

    if (!allowedMimeTypes.includes(mimeType)) {
      throw APIError.invalidArgument("File type not supported. Please upload images (JPG, PNG, GIF, WebP) or PDF files.");
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(fileData, 'base64');
    
    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileBuffer.length > maxSize) {
      throw APIError.invalidArgument("File size too large. Maximum size is 100MB.");
    }

    // Get existing file info and verify access
    const existingFile = await uploadsDB.queryRow`
      SELECT f.id, f.filename, f.file_path, f.uploaded_by_user_id
      FROM files f
      WHERE f.id = ${fileId} AND f.org_id = ${authData.orgId}
    `;

    if (!existingFile) {
      throw APIError.notFound("File not found or access denied");
    }

    // Check if user can update this file
    // Admins can update any file, managers can only update their own files
    if (authData.role === "MANAGER" && existingFile.uploaded_by_user_id !== parseInt(authData.userID)) {
      throw APIError.permissionDenied("You can only update files you uploaded");
    }

    try {
      // Generate new unique filename
      const fileExtension = path.extname(filename) || getExtensionFromMimeType(mimeType);
      const newUniqueFilename = `${randomUUID()}${fileExtension}`;
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', authData.orgId.toString());
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Save new file to disk
      const newFilePath = path.join(uploadsDir, newUniqueFilename);
      fs.writeFileSync(newFilePath, fileBuffer);

      // Update file record in database
      const updatedFile = await uploadsDB.queryRow`
        UPDATE files 
        SET filename = ${newUniqueFilename}, 
            original_name = ${filename}, 
            mime_type = ${mimeType}, 
            file_size = ${fileBuffer.length}, 
            file_path = ${newFilePath}
        WHERE id = ${fileId} AND org_id = ${authData.orgId}
        RETURNING id, filename
      `;

      if (!updatedFile) {
        // Clean up new file if database update failed
        try {
          fs.unlinkSync(newFilePath);
        } catch (error) {
          console.error('Failed to clean up new file:', error);
        }
        throw APIError.internal("Failed to update file record");
      }

      // Delete old file from disk
      try {
        if (fs.existsSync(existingFile.file_path)) {
          fs.unlinkSync(existingFile.file_path);
        }
      } catch (error) {
        console.error('Failed to delete old file:', error);
        // Don't fail the operation if old file cleanup fails
      }

    return {
      fileId: updatedFile.id,
      filename: updatedFile.filename,
      url: `/uploads/file/${updatedFile.id}`,
      message: "File updated successfully"
    };
  } catch (error: any) {
    console.error('Update file error:', error);
    throw APIError.internal(`Failed to update file: ${error.message}`);
  }
}

// LEGACY: Update/replace a file (keep for backward compatibility)
export const updateFile = api<UpdateFileRequest, UpdateFileResponse>(
  { auth: true, expose: true, method: "PUT", path: "/uploads/file/:fileId" },
  updateFileHandler
);

// V1: Update/replace a file
export const updateFileV1 = api<UpdateFileRequest, UpdateFileResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/uploads/file/:fileId" },
  updateFileHandler
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
  return mimeToExt[mimeType] || '.bin';
}
