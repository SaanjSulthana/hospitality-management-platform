/**
 * Encore Cloud Storage Buckets
 * 
 * This module defines all object storage buckets used in the application.
 * - Private buckets: receipts, guest-documents (use signed URLs for access)
 * - Public buckets: task-images, logos (CDN-backed, direct access)
 */

import { Bucket } from "encore.dev/storage/objects";

/**
 * Private bucket for finance receipts
 * Used by: Finance service for storing transaction receipts
 * Access: Signed URLs with 24-hour expiry
 * Path structure: {orgId}/{filename}
 */
export const receiptsBucket = new Bucket("receipts", {
  versioned: false,
  public: false,
});

/**
 * Private bucket for guest ID documents (passports, visas, etc.)
 * Used by: Guest check-in service for storing identity documents
 * Access: Signed URLs with 24-hour expiry
 * Path structure: {orgId}/{guestCheckInId}/{filename}
 */
export const guestDocumentsBucket = new Bucket("guest-documents", {
  versioned: false,
  public: false,
});

/**
 * Public bucket for task reference images
 * Used by: Tasks service for storing task photos/reference images
 * Access: Public CDN URLs
 * Path structure: {orgId}/task_{taskId}/{filename}
 */
export const taskImagesBucket = new Bucket("task-images", {
  versioned: false,
  public: true,
});

/**
 * Public bucket for organization logos
 * Used by: Branding service for storing organization logos
 * Access: Public CDN URLs
 * Path structure: {orgId}/{filename}
 */
export const logosBucket = new Bucket("logos", {
  versioned: false,
  public: true,
});

/**
 * Private bucket for generated document exports (PDFs, Excel files)
 * Used by: Documents service for storing temporary export files
 * Access: Signed URLs with 1-hour expiry
 * Path structure: {orgId}/exports/{exportId}.{format}
 * Lifecycle: Auto-expired after 24 hours via cron cleanup
 */
export const documentExportsBucket = new Bucket("document-exports", {
  versioned: false,
  public: false,
});


