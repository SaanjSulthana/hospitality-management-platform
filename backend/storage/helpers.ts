/**
 * Storage Helper Utilities
 * 
 * Provides reusable functions for working with Encore buckets and local file storage.
 */

import * as fs from "fs";

/**
 * Download file from bucket or local disk based on storage location
 * 
 * @param storageLocation - Either 'cloud' or 'local'
 * @param bucketKey - Path in bucket (required if cloud)
 * @param filePath - Local file path (required if local)
 * @param bucket - Bucket instance (required if cloud)
 * @returns File buffer
 */
export async function downloadFromBucketOrDisk(
  storageLocation: string,
  bucketKey: string | null,
  filePath: string,
  bucket: any
): Promise<Buffer> {
  if (storageLocation === 'cloud' && bucketKey) {
    return await bucket.download(bucketKey);
  } else {
    // Legacy: load from local disk
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found on disk");
    }
    return fs.readFileSync(filePath);
  }
}

/**
 * Delete file from bucket or local disk based on storage location
 * 
 * @param storageLocation - Either 'cloud' or 'local'
 * @param bucketKey - Path in bucket (required if cloud)
 * @param filePath - Local file path (required if local)
 * @param bucket - Bucket instance (required if cloud)
 */
export async function deleteFromBucketOrDisk(
  storageLocation: string,
  bucketKey: string | null,
  filePath: string,
  bucket: any
): Promise<void> {
  if (storageLocation === 'cloud' && bucketKey) {
    await bucket.remove(bucketKey);
  } else {
    // Legacy: delete from local disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}


