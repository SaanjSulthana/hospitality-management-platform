import { Service } from "encore.dev/service";

export default new Service("tasks");

// Export all task endpoints
export { create } from "./create";
export { list } from "./list";
export { assign } from "./assign";
export { updateStatus } from "./update_status";
export { updateHours } from "./update_hours";
export { addAttachment } from "./add_attachment";

// Export task image endpoints
export { uploadTaskImage } from "./images";
export { getTaskImages } from "./images";
export { deleteTaskImage } from "./images";
export { setPrimaryImage } from "./images";

// Export database setup endpoint
export { setupTaskAttachmentsTable } from "./setup_task_attachments_table";
export { quickSetupAttachments } from "./quick_setup_attachments";