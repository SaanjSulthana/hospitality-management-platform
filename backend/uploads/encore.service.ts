import { Service } from "encore.dev/service";

export default new Service("uploads");

// Export upload endpoints
export { uploadFile } from "./upload";
export { downloadFile } from "./download";
export { getFileInfo } from "./download";
export { serveTaskImage } from "./serve_task_image";
export { setupFilesTable } from "./setup_files_table";