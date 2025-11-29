import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import log from "encore.dev/log";

// Shared handler for OTA sync
async function otaSyncHandlerImpl(): Promise<void> {
    try {
      // Placeholder for OTA integration
      // This would sync with booking.com, Airbnb, Expedia, etc.
      
      log.info("OTA sync started (placeholder)");
      
      // TODO: Implement actual OTA integrations
      // - Fetch new bookings from OTA platforms
      // - Update inventory and rates
      // - Sync availability calendars
      // - Handle booking modifications and cancellations
      
      log.info("OTA sync completed (placeholder)");
    } catch (error) {
      log.error("OTA sync failed:", error);
    }
}

// OTA sync API endpoint

// LEGACY: Syncs with OTA platforms (keep for backward compatibility)
export const otaSyncHandler = api<{}, void>(
  { expose: false, method: "POST", path: "/cron/ota-sync" },
  otaSyncHandlerImpl
);

// V1: Syncs with OTA platforms
export const otaSyncHandlerV1 = api<{}, void>(
  { expose: false, method: "POST", path: "/v1/system/cron/ota-sync" },
  otaSyncHandlerImpl
);

// OTA sync cron job - runs every 10 minutes (placeholder)
const otaSync = new CronJob("ota-sync", {
  title: "OTA Sync",
  schedule: "*/10 * * * *",
  endpoint: otaSyncHandler,
});
