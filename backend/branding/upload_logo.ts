import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { brandingDB } from "./db";
import { requireRole } from "../auth/middleware";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export interface UploadLogoRequest {
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

export interface UploadLogoResponse {
  logoUrl: string;
  filename: string;
}

// Upload organization logo
export const uploadLogo = api<UploadLogoRequest, UploadLogoResponse>(
  { auth: true, expose: true, method: "POST", path: "/branding/logo" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    console.log('Logo upload request:', { orgId: authData.orgId, filename: req.filename });

    // Validate file type - only allow images
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];

    if (!allowedMimeTypes.includes(req.mimeType)) {
      throw APIError.invalidArgument("File type not supported. Please upload images (JPG, PNG, GIF, WebP, SVG) only.");
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(req.fileData, 'base64');
    
    // Validate file size (max 5MB for logos)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > maxSize) {
      throw APIError.invalidArgument("File size too large. Maximum size is 5MB for logos.");
    }

    // Generate unique filename
    const fileExtension = path.extname(req.filename) || getExtensionFromMimeType(req.mimeType);
    const uniqueFilename = `logo_${randomUUID()}${fileExtension}`;
    
    // Create logos directory if it doesn't exist
    const logosDir = path.join(process.cwd(), 'uploads', 'logos', authData.orgId.toString());
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }

    // Save file to disk
    const filePath = path.join(logosDir, uniqueFilename);
    fs.writeFileSync(filePath, fileBuffer);

    // Generate the URL that will be used to access the logo
    const logoUrl = `/uploads/logos/${authData.orgId}/${uniqueFilename}`;

    console.log('Logo uploaded successfully:', {
      orgId: authData.orgId,
      filename: uniqueFilename,
      logoUrl: logoUrl,
      fileSize: fileBuffer.length
    });

    return {
      logoUrl: logoUrl,
      filename: uniqueFilename,
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
    'image/svg+xml': '.svg'
  };
  
  return mimeToExt[mimeType] || '.jpg';
}

