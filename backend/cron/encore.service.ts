import { Service } from "encore.dev/service";

export default new Service("cron");

// Export all cron endpoints
export { nightAudit } from "./night_audit";
export { otaSync } from "./ota_sync";
export { taskReminders } from "./task_reminders";