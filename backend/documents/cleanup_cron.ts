/**
 * Document Export Cleanup Cron Job
 * Removes expired exports (>24 hours old) from database and storage
 */

import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { documentsDB } from "./db";
import { documentExportsBucket } from "../storage/buckets";

/**
 * Cleanup endpoint - can be called manually or via cron
 */
export const runDocumentCleanup = api<{}, { success: boolean; message: string; deleted: number; errors: number }>(
  { auth: false, expose: false, method: "POST", path: "/documents/cleanup" },
  async () => {
    console.log("[DocumentCleanup] Starting cleanup job");
    
    let deletedCount = 0;
    let errorCount = 0;

    try {
      // Find expired exports (older than 24 hours and status = 'ready')
      const expiredExports = await documentsDB.query<{
        export_id: string;
        bucket_key: string | null;
        storage_location: string;
      }>`
        SELECT export_id, bucket_key, storage_location
        FROM document_exports
        WHERE status = 'ready'
        AND expires_at < NOW()
      `;

      console.log(`[DocumentCleanup] Found ${expiredExports.length} expired exports`);

      for (const exp of expiredExports) {
        try {
          // Delete from bucket if exists
          if (exp.bucket_key && exp.storage_location === 'cloud') {
            try {
              await documentExportsBucket.remove(exp.bucket_key);
              console.log(`[DocumentCleanup] Deleted from bucket: ${exp.bucket_key}`);
            } catch (error) {
              console.error(`[DocumentCleanup] Failed to delete from bucket: ${exp.bucket_key}`, error);
              // Continue with status update even if bucket deletion fails
            }
          }

          // Update status to expired (soft delete)
          await documentsDB.exec`
            UPDATE document_exports
            SET status = 'expired',
                bucket_key = NULL,
                updated_at = NOW()
            WHERE export_id = ${exp.export_id}
          `;

          deletedCount++;
          console.log(`[DocumentCleanup] Marked as expired: ${exp.export_id}`);
        } catch (error) {
          errorCount++;
          console.error(`[DocumentCleanup] Failed to process export ${exp.export_id}:`, error);
        }
      }

      // Optionally: Hard delete expired records older than 7 days
      const hardDeleteResult = await documentsDB.exec`
        DELETE FROM document_exports
        WHERE status = 'expired'
        AND updated_at < NOW() - INTERVAL '7 days'
      `;

      console.log(`[DocumentCleanup] Hard deleted old expired records`);

      const message = `Cleanup completed: ${deletedCount} exports expired, ${errorCount} errors`;
      console.log(`[DocumentCleanup] ${message}`);

      return {
        success: true,
        message,
        deleted: deletedCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error("[DocumentCleanup] Cleanup failed:", error);
      return {
        success: false,
        message: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        deleted: deletedCount,
        errors: errorCount,
      };
    }
  }
);

/**
 * Cron job - runs daily at 2 AM
 */
export const documentCleanupCron = new CronJob("document-cleanup", {
  title: "Document Export Cleanup",
  schedule: "0 2 * * *", // 2 AM every day
  endpoint: runDocumentCleanup,
});

