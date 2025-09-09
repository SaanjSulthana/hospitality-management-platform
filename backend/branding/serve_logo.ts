import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { brandingDB } from "./db";
import { requireRole } from "../auth/middleware";
import * as fs from "fs";
import * as path from "path";

export interface ServeLogoRequest {
  orgId: string;
  filename: string;
}

export interface ServeLogoResponse {
  fileData: string; // base64 encoded file data
  mimeType: string;
}

// Serve organization logo
export const serveLogo = api<ServeLogoRequest, ServeLogoResponse>(
  { auth: true, expose: true, method: "GET", path: "/branding/logo/:orgId/:filename" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    try {
      const { orgId, filename } = req;

      console.log('Logo serve request:', { orgId, filename });

      // Validate that the user has access to this organization's logo
      if (authData.orgId.toString() !== orgId) {
        throw APIError.permissionDenied("Access denied to this logo");
      }

      // Construct file path
      const filePath = path.join(process.cwd(), 'uploads', 'logos', orgId, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw APIError.notFound("Logo file not found");
      }

      // Read file from disk
      const fileBuffer = fs.readFileSync(filePath);

      // Determine MIME type from file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      const mimeType = mimeTypes[ext] || 'image/jpeg';

      console.log('Logo served successfully:', {
        orgId: orgId,
        filename: filename,
        fileSize: fileBuffer.length,
        mimeType: mimeType
      });

      return {
        fileData: fileBuffer.toString('base64'),
        mimeType: mimeType,
      };
    } catch (error: any) {
      console.error('Logo serve failed:', error);
      
      // Re-throw API errors as-is
      if (error instanceof APIError) {
        throw error;
      }
      
      // Convert other errors to internal server error
      throw APIError.internal("Failed to serve logo");
    }
  }
);

