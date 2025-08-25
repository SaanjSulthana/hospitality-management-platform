import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { cronDB } from "./db";
import log from "encore.dev/log";

// Night audit API endpoint
export const nightAuditHandler = api<void, void>(
  { expose: false, method: "POST", path: "/cron/night-audit" },
  async () => {
    log.info("Starting night audit process");

    const tx = await cronDB.begin();
    try {
      // Get all organizations
      const orgs = await tx.queryAll`
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

        // Get all bookings that were checked in yesterday for this org
        const bookings = await tx.queryAll`
          SELECT b.id, b.property_id, b.price_cents, b.currency
          FROM bookings b
          WHERE b.org_id = ${org.id}
            AND b.status = 'checked_in'
            AND b.checkin_date = ${yesterday.toISOString().split('T')[0]}
        `;

        // Create revenue records for room bookings with booking_id for idempotency
        for (const booking of bookings) {
          const metaJson = JSON.stringify({ booking_id: booking.id });
          await tx.exec`
            INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, occurred_at, meta_json, created_by_user_id)
            SELECT ${org.id}, ${booking.property_id}, 'room', ${booking.price_cents}, ${booking.currency}, ${yesterday}, ${metaJson}, u.id
            FROM users u 
            WHERE u.org_id = ${org.id} AND u.role = 'ADMIN' 
            LIMIT 1
            ON CONFLICT (org_id, property_id, occurred_at, meta_json) DO NOTHING
          `;
        }

        log.info(`Processed ${bookings.length} bookings for ${org.name}`);
      }

      await tx.commit();
      log.info("Night audit completed successfully");
    } catch (error) {
      await tx.rollback();
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
