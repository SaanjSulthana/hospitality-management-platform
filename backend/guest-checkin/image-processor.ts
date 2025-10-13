/**
 * Image Processing Service
 * Handles image resizing, thumbnail generation, and EXIF stripping using Sharp
 */

import sharp from "sharp";
import log from "encore.dev/log";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

// Configuration
const MAX_IMAGE_DIMENSION = 2048;
const THUMBNAIL_SIZE = 300;
const IMAGE_QUALITY = 85;
const THUMBNAIL_QUALITY = 80;
// Note: This validates the decoded file size, not the base64-encoded request size
// Base64 encoding adds ~33% overhead, so a 100MB file becomes ~133MB in the request
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB (decoded file size) - Increased to handle larger documents

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface FileStorageInfo {
  filename: string;
  filePath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  fileSize: number;
  thumbnailSize: number;
}

// Validate image file
export function validateImage(mimeType: string, fileSize: number): ValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: "File type not supported. Please upload JPEG, PNG, or WEBP images.",
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  return { valid: true };
}

// Process and optimize uploaded image
export async function processImage(imageBuffer: Buffer): Promise<ProcessedImage> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Invalid image buffer");
  }

  try {
    log.info("Processing image", { originalSize: imageBuffer.length });

    const processed = await sharp(imageBuffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .rotate() // Auto-rotate based on EXIF orientation
      .jpeg({ quality: IMAGE_QUALITY })
      .toBuffer({ resolveWithObject: true });

    log.info("Image processed successfully", {
      originalSize: imageBuffer.length,
      processedSize: processed.data.length,
      width: processed.info.width,
      height: processed.info.height,
    });

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
      format: processed.info.format,
      size: processed.data.length,
    };
  } catch (error: any) {
    log.error("Image processing failed", { error: error.message });
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

// Generate thumbnail
export async function generateThumbnail(imageBuffer: Buffer): Promise<ThumbnailResult> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Invalid image buffer for thumbnail");
  }

  try {
    log.info("Generating thumbnail", { originalSize: imageBuffer.length });

    const thumbnail = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer({ resolveWithObject: true });

    log.info("Thumbnail generated", {
      size: thumbnail.data.length,
      dimensions: `${thumbnail.info.width}x${thumbnail.info.height}`,
    });

    return {
      buffer: thumbnail.data,
      width: thumbnail.info.width,
      height: thumbnail.info.height,
      size: thumbnail.data.length,
    };
  } catch (error: any) {
    log.error("Thumbnail generation failed", { error: error.message });
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

// Strip EXIF metadata for privacy (except orientation)
export async function stripEXIFData(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Sharp automatically removes most EXIF data when processing
    // We only preserve orientation info via the rotate() method
    const processed = await sharp(imageBuffer)
      .rotate() // Handles orientation, then removes EXIF
      .jpeg()
      .toBuffer();

    log.info("EXIF data stripped", {
      originalSize: imageBuffer.length,
      processedSize: processed.length,
    });

    return processed;
  } catch (error: any) {
    log.error("EXIF stripping failed", { error: error.message });
    throw new Error(`Failed to strip EXIF data: ${error.message}`);
  }
}

// Get image dimensions without full processing
export async function getImageDimensions(imageBuffer: Buffer): Promise<ImageDimensions> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error: any) {
    log.error("Failed to get image dimensions", { error: error.message });
    throw new Error(`Failed to get image dimensions: ${error.message}`);
  }
}

// Generate unique filename for storage
export function generateFilename(
  documentType: string,
  originalExtension: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const uuid = uuidv4();
  const ext = originalExtension.startsWith(".") ? originalExtension : `.${originalExtension}`;
  
  return `${documentType}_${timestamp}_${uuid}${ext}`;
}

// Get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  return mimeMap[mimeType] || ".jpg";
}

// Create storage directory structure
export function ensureStorageDirectory(orgId: number, guestCheckInId: number): string {
  const baseDir = path.join(process.cwd(), "uploads", "guest-documents");
  const orgDir = path.join(baseDir, orgId.toString());
  const guestDir = path.join(orgDir, guestCheckInId.toString());

  // Create directories if they don't exist
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(orgDir)) {
    fs.mkdirSync(orgDir, { recursive: true });
  }
  if (!fs.existsSync(guestDir)) {
    fs.mkdirSync(guestDir, { recursive: true });
  }

  return guestDir;
}

// Save image and thumbnail to disk
export async function saveImageToDisk(
  imageBuffer: Buffer,
  documentType: string,
  originalFilename: string,
  orgId: number,
  guestCheckInId: number
): Promise<FileStorageInfo> {
  try {
    log.info("Saving image to disk", { documentType, orgId, guestCheckInId });

    // Process main image
    const processed = await processImage(imageBuffer);

    // Generate thumbnail
    const thumbnail = await generateThumbnail(imageBuffer);

    // Ensure storage directory exists
    const storageDir = ensureStorageDirectory(orgId, guestCheckInId);

    // Generate filenames
    const extension = path.extname(originalFilename) || ".jpg";
    const filename = generateFilename(documentType, extension);
    const thumbnailFilename = filename.replace(extension, `_thumb${extension}`);

    // Save main image
    const filePath = path.join(storageDir, filename);
    fs.writeFileSync(filePath, processed.buffer);

    // Save thumbnail
    const thumbnailPath = path.join(storageDir, thumbnailFilename);
    fs.writeFileSync(thumbnailPath, thumbnail.buffer);

    log.info("Image saved successfully", {
      filePath,
      thumbnailPath,
      fileSize: processed.size,
      thumbnailSize: thumbnail.size,
    });

    return {
      filename,
      filePath,
      thumbnailPath,
      width: processed.width,
      height: processed.height,
      fileSize: processed.size,
      thumbnailSize: thumbnail.size,
    };
  } catch (error: any) {
    log.error("Failed to save image", { error: error.message, documentType });
    throw new Error(`Failed to save image: ${error.message}`);
  }
}

// Delete image from disk (for cleanup)
export function deleteImageFromDisk(filePath: string, thumbnailPath?: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.info("Image file deleted", { filePath });
    }

    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
      log.info("Thumbnail deleted", { thumbnailPath });
    }
  } catch (error: any) {
    log.error("Failed to delete image files", { error: error.message, filePath });
  }
}

// Check if file exists
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// Get file size
export function getFileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  
  const stats = fs.statSync(filePath);
  return stats.size;
}

