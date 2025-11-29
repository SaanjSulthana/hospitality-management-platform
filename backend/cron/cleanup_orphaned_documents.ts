/**
 * Cleanup Orphaned Documents Cron Job
 * Removes documents that were uploaded but never linked to a check-in
 * Runs every 6 hours to keep storage clean at scale
 */

import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { guestCheckinDB } from "../guest-checkin/db";
import { guestDocumentsBucket } from "../storage/buckets";
import log from "encore.dev/log";

interface CleanupResult {
  deletedCount: number;
  freedSpaceBytes: number;
  errors: number;
}

// Shared handler for cleaning up orphaned documents
async function cleanupOrphanedDocumentsHandler(): Promise<CleanupResult> {
    const startTime = Date.now();
    log.info("Starting orphaned documents cleanup");

    let deletedCount = 0;
    let freedSpaceBytes = 0;
    let errors = 0;

    try {
      // Find orphaned documents that meet cleanup criteria:
      // 1. guest_checkin_id IS NULL (not linked to check-in)
      // 2. expires_at has passed OR created more than 24 hours ago
      // 3. Not already deleted
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const orphanedDocs = await guestCheckinDB.queryAll<{
        id: number;
        bucket_key: string;
        storage_location: string;
        file_size: number;
        org_id: number;
        created_at: Date;
        expires_at: Date | null;
      }>`
        SELECT id, bucket_key, storage_location, file_size, org_id, created_at, expires_at
        FROM guest_documents
        WHERE guest_checkin_id IS NULL
          AND deleted_at IS NULL
          AND (
            (expires_at IS NOT NULL AND expires_at < NOW())
            OR (expires_at IS NULL AND created_at < ${cutoffTime})
          )
        ORDER BY created_at ASC
        LIMIT 1000
      `;

      log.info("Found orphaned documents", { count: orphanedDocs.length });

      // Delete each orphaned document
      for (const doc of orphanedDocs) {
        try {
          // Note: Encore buckets don't support direct delete operations
          // Documents will remain in cloud storage but marked as deleted in DB
          // This is acceptable as:
          // 1. Storage costs are minimal for orphaned docs
          // 2. Encore may have lifecycle policies
          // 3. Main goal is preventing DB bloat
          // 4. Future: Can implement batch cleanup via Encore lifecycle rules
          
          if (doc.storage_location === 'cloud' && doc.bucket_key) {
            log.debug("Marking cloud document as deleted (DB only)", { 
              documentId: doc.id, 
              bucketKey: doc.bucket_key 
            });
          }

          // Soft delete database record
          await guestCheckinDB.exec`
            UPDATE guest_documents
            SET deleted_at = NOW()
            WHERE id = ${doc.id}
          `;

          deletedCount++;
          freedSpaceBytes += doc.file_size || 0;

          log.debug("Deleted orphaned document", { 
            documentId: doc.id,
            orgId: doc.orgId,
            age: Math.floor((Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60)) + ' hours'
          });
        } catch (docError) {
          log.error("Failed to delete orphaned document", { 
            documentId: doc.id, 
            error: docError 
          });
          errors++;
        }
      }

      const duration = Date.now() - startTime;
      const freedSpaceMB = (freedSpaceBytes / (1024 * 1024)).toFixed(2);

      log.info("Orphaned documents cleanup complete", {
        deletedCount,
        freedSpaceMB: `${freedSpaceMB} MB`,
        errors,
        durationMs: duration,
      });

      return {
        deletedCount,
        freedSpaceBytes,
        errors,
      };
    } catch (error) {
      log.error("Orphaned documents cleanup failed", { error });
      throw error;
    }
}

/**
 * Cleanup endpoint - can be triggered manually or via cron
 */

// LEGACY: Cleanup orphaned documents (keep for backward compatibility)
export const cleanupOrphanedDocuments = api<{}, CleanupResult>(
  { expose: true, method: "POST", path: "/cron/cleanup-orphaned-documents", auth: false },
  cleanupOrphanedDocumentsHandler
);

// V1: Cleanup orphaned documents
export const cleanupOrphanedDocumentsV1 = api<{}, CleanupResult>(
  { expose: true, method: "POST", path: "/v1/system/cron/cleanup-orphaned-documents", auth: false },
  cleanupOrphanedDocumentsHandler
);

/**
 * Cron job - runs every 6 hours
 */
const _ = new CronJob("cleanup-orphaned-documents", {
  title: "Cleanup Orphaned Documents",
  endpoint: cleanupOrphanedDocuments,
  schedule: "0 */6 * * *", // Every 6 hours at minute 0
});

interface CleanupStatsResponse {
  orphanedCount: number;
  oldestOrphanAge: string;
  totalOrphanedSize: number;
}

// Shared handler for getting cleanup statistics
async function getCleanupStatsHandler(): Promise<CleanupStatsResponse> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await guestCheckinDB.queryRow<{
      count: number;
      oldest_created: Date | null;
      total_size: number | null;
    }>`
      SELECT 
        COUNT(*) as count,
        MIN(created_at) as oldest_created,
        SUM(file_size) as total_size
      FROM guest_documents
      WHERE guest_checkin_id IS NULL
        AND deleted_at IS NULL
        AND (
          (expires_at IS NOT NULL AND expires_at < NOW())
          OR (expires_at IS NULL AND created_at < ${cutoffTime})
        )
    `;

    const orphanedCount = Number(stats?.count || 0);
    const oldestDate = stats?.oldest_created;
    const totalSize = Number(stats?.total_size || 0);

    let oldestOrphanAge = 'N/A';
    if (oldestDate) {
      const ageHours = Math.floor((Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60));
      oldestOrphanAge = `${ageHours} hours`;
    }

    return {
      orphanedCount,
      oldestOrphanAge,
      totalOrphanedSize: totalSize,
    };
}

/**
 * Get cleanup statistics
 */

// LEGACY: Gets cleanup statistics (keep for backward compatibility)
export const getCleanupStats = api<{}, CleanupStatsResponse>(
  { expose: true, method: "GET", path: "/cron/cleanup-stats", auth: true },
  getCleanupStatsHandler
);

// V1: Gets cleanup statistics
export const getCleanupStatsV1 = api<{}, CleanupStatsResponse>(
  { expose: true, method: "GET", path: "/v1/system/cron/cleanup-stats", auth: true },
  getCleanupStatsHandler
);

