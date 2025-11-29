import { Service } from "encore.dev/service";

export default new Service("tasks");

// Ensure subscriber is registered
import "./tasks_realtime_subscriber";

// Export all task endpoints
export { create } from "./create";
export { list } from "./list";
export { update } from "./update";
export { deleteTask } from "./delete";
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

// Export realtime subscribe endpoint
export { subscribeTasksRealtime } from "./subscribe_realtime";