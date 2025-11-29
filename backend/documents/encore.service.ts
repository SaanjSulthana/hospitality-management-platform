import { Service } from "encore.dev/service";

export default new Service("documents");

// Export all document endpoints
export { createExport } from "./create_export";
export { getExportStatus } from "./get_export_status";
export { downloadExport } from "./download_export";
export { retryExport } from "./retry_export";
export { deleteExport } from "./delete_export";
export { listExports } from "./list_exports";
export { processExport } from "./process_export";

// Export cron job
export { runDocumentCleanup, documentCleanupCron } from "./cleanup_cron";

