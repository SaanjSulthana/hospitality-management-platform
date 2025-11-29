// Partition Maintenance Cron Job
// Runs monthly to create next month's partitions automatically
// Ensures partitions exist before data needs to be inserted

import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { partitioningManager } from "../database/partitioning_manager";

interface PartitionResponse {
  success: boolean;
  message: string;
}

// Shared handler for creating next month partitions
async function createNextMonthPartitionsHandler(): Promise<PartitionResponse> {
  console.log('[PartitionMaintenance] Starting monthly partition maintenance...');
  
  try {
    // Check if maintenance is enabled
    const featureFlags = partitioningManager.getFeatureFlags();
    if (!featureFlags.get('enable_partition_maintenance')) {
      console.log('[PartitionMaintenance] Partition maintenance is disabled, skipping');
      return;
    }

    // Create next month's partitions
    await partitioningManager.createNextMonthPartitions();
    
    // Optionally: Create partitions for the next 3 months to be safe
    // await partitioningManager.createPartitionsForNextMonths(3);
    
    // Check current month partitions
    const currentMonthExists = await partitioningManager.checkCurrentMonthPartitions();
    if (!currentMonthExists) {
      console.warn('[PartitionMaintenance] Current month partitions missing! Creating them now...');
      // If current month is missing, create it immediately
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      console.log(`[PartitionMaintenance] Creating missing partitions for ${year}-${month}`);
      await partitioningManager.createPartitionsForNextMonths(1);
    }

    console.log('[PartitionMaintenance] Monthly partition maintenance completed successfully');
    return { success: true, message: 'Partition maintenance completed' };
  } catch (error) {
    console.error('[PartitionMaintenance] Failed to create partitions:', error);
    return { success: false, message: `Failed: ${error.message}` };
  }
}

// Create partitions for next month - API endpoint

// LEGACY: Creates next month partitions (keep for backward compatibility)
export const createNextMonthPartitions = api<{}, PartitionResponse>(
  { expose: false, method: "POST", path: "/internal/partitions/create-next-month" },
  createNextMonthPartitionsHandler
);

// V1: Creates next month partitions
export const createNextMonthPartitionsV1 = api<{}, PartitionResponse>(
  { expose: false, method: "POST", path: "/v1/system/cron/partitions/create-next-month" },
  createNextMonthPartitionsHandler
);

// Run on the 1st of every month at 2:00 AM
// Schedule: "0 2 1 * *" (minute hour day month weekday)
export const partitionMaintenance = new CronJob("partition-maintenance", {
  title: "Partition Maintenance",
  schedule: "0 2 1 * *",
  endpoint: createNextMonthPartitions,
});

// Shared handler for cleaning up old partitions
async function cleanupOldPartitionsHandler(): Promise<PartitionResponse> {
  console.log('[PartitionCleanup] Starting partition cleanup...');
  
  try {
    // Check if maintenance is enabled
    const featureFlags = partitioningManager.getFeatureFlags();
    if (!featureFlags.get('enable_partition_maintenance')) {
      console.log('[PartitionCleanup] Partition maintenance is disabled, skipping');
      return;
    }

    // Drop partitions older than 24 months
    // Adjust retention period based on your requirements
    const retentionMonths = parseInt(process.env.PARTITION_RETENTION_MONTHS || '24');
    await partitioningManager.dropOldPartitions(retentionMonths);
    
    console.log('[PartitionCleanup] Partition cleanup completed successfully');
    return { success: true, message: 'Partition cleanup completed' };
  } catch (error) {
    console.error('[PartitionCleanup] Failed to cleanup partitions:', error);
    return { success: false, message: `Failed: ${error.message}` };
  }
}

// Clean up old partitions (older than 24 months by default) - API endpoint

// LEGACY: Cleans up old partitions (keep for backward compatibility)
export const cleanupOldPartitions = api<{}, PartitionResponse>(
  { expose: false, method: "POST", path: "/internal/partitions/cleanup" },
  cleanupOldPartitionsHandler
);

// V1: Cleans up old partitions
export const cleanupOldPartitionsV1 = api<{}, PartitionResponse>(
  { expose: false, method: "POST", path: "/v1/system/cron/partitions/cleanup" },
  cleanupOldPartitionsHandler
);

// Optional: Run on the 15th of every month at 3:00 AM to clean up old partitions
export const partitionCleanup = new CronJob("partition-cleanup", {
  title: "Partition Cleanup",
  schedule: "0 3 15 * *",
  endpoint: cleanupOldPartitions,
});

