import { Service } from "encore.dev/service";

export default new Service("users");

// Export all user endpoints
export { create } from "./create";
export { get } from "./get";
export { update } from "./update";
export { list } from "./list";
export { assignProperties } from "./assign_properties";
export { updateActivity } from "./update_activity";