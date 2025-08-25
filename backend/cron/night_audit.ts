import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { cronDB } from "./db";
import log from "encore.dev/log";

// Night audit API endpoint
export const nightAuditHandler = api<void, void>(
  { expose: false, method: "POST", path: "/cron/night-audit" },
  async () => {
    log.info("Starting night audit process");

    try {
      // Get all organizations
      const orgs = await cronDB.queryAll`
        SELECT id, name FROM organizations
      `;

      for (const org of orgs) {
        log.info(`Processing night audit for organization: ${org.name}`);

        // Finalize yesterday's revenues
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        // Get all bookings that were checked in yesterday
        const bookings = await cronDB.queryAll`
          SELECT b.id, b.property_id, b.price_cents, b.currency
          FROM bookings b
          WHERE b.org_id = ${org.id}
            AND b.status = 'checked_in'
            AND b.checkin_date = ${yesterday.toISOString().split('T')[0]}
        `;

        // Create revenue records for room bookings
        for (const booking of bookings) {
          await cronDB.exec`
            INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, occurred_at)
            VALUES (${org.id}, ${booking.property_id}, 'room', ${booking.price_cents}, ${booking.currency}, ${yesterday})
            ON CONFLICT DO NOTHING
          `;
        }

        log.info(`Processed ${bookings.length} bookings for ${org.name}`);
      }

      log.info("Night audit completed successfully");
    } catch (error) {
      log.error("Night audit failed:", error);
      throw error;
    }
  }
);

// Night audit cron job - runs daily at 5 AM
const nightAudit = new CronJob("night-audit", {
  title: "Night Audit",
  schedule: "0 5 * * *",
  endpoint: nightAuditHandler,
});
