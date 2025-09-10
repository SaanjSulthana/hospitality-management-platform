import { Service } from "encore.dev/service";

export default new Service("analytics");

// Export all analytics endpoints
export { getOverview } from "./overview";