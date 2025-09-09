import { Service } from "encore.dev/service";

export default new Service("uploads");

// Export upload endpoints
export { uploadFile } from "./upload";
export { downloadFile } from "./download";
export { serveTaskImage } from "./serve_task_image";