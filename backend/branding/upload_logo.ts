import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { brandingDB } from "./db";
import { requireRole } from "../auth/middleware";
import { logosBucket } from "../storage/buckets";
import { brandingEvents } from "./events";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface UploadLogoRequest {
  fileData: string; // base64 encoded file data
  filename: string;
  mimeType: string;
}

export interface UploadLogoResponse {
  logoUrl: string;
  filename: string;
}

// Shared handler for uploading organization logo
async function uploadLogoHandler(req: UploadLogoRequest): Promise<UploadLogoResponse> {
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
    
    // Upload to Encore Cloud bucket (public with CDN)
    const bucketKey = `${authData.orgId}/${uniqueFilename}`;
    
    try {
      await logosBucket.upload(bucketKey, fileBuffer, {
        contentType: req.mimeType
      });
    } catch (error) {
      console.error('Failed to upload logo to bucket:', error);
      throw APIError.internal("Failed to upload logo to cloud storage");
    }

    // Get public CDN URL
    const logoUrl = logosBucket.publicUrl(bucketKey);

    console.log('Logo uploaded successfully:', {
      orgId: authData.orgId,
      filename: uniqueFilename,
      logoUrl: logoUrl,
      fileSize: fileBuffer.length
    });

    const result = {
      logoUrl: logoUrl,
      filename: uniqueFilename,
    };

    // Publish event
    try {
      await brandingEvents.publish({
        eventId: uuidv4(),
        eventVersion: "v1",
        eventType: "logo_uploaded",
        orgId: authData.orgId,
        userId: Number(authData.userID) || null,
        propertyId: null,
        timestamp: new Date(),
        entityId: authData.orgId,
        entityType: "branding",
        metadata: {
          filename: uniqueFilename,
          logoUrl,
          mimeType: req.mimeType,
          sizeBytes: fileBuffer.length,
        },
      });
    } catch (pubErr) {
      console.warn("[BrandingRealtime] Failed to publish logo_uploaded event:", pubErr);
    }

    return result;
}

// LEGACY: Upload organization logo (keep for backward compatibility)
export const uploadLogo = api<UploadLogoRequest, UploadLogoResponse>(
  { auth: true, expose: true, method: "POST", path: "/branding/logo" },
  uploadLogoHandler
);

// V1: Upload organization logo
export const uploadLogoV1 = api<UploadLogoRequest, UploadLogoResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/branding/logo" },
  uploadLogoHandler
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

