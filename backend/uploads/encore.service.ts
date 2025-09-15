import { Service } from "encore.dev/service";

export default new Service("uploads");

// Export upload endpoints
export { uploadFile } from "./upload";
export { checkFilesTable } from "./check_files_table";
export { downloadFile } from "./download";
export { getFileInfo } from "./download";
export { serveTaskImage } from "./serve_task_image";
export { setupFilesTable } from "./setup_files_table";
export { deleteFile } from "./delete_file";
export { updateFile } from "./update_file";
export { cleanupOrphanedFiles } from "./cleanup_orphaned_files";