import { Service } from "encore.dev/service";

export default new Service("properties");

// Ensure subscriber is registered
import "./properties_realtime_subscriber";

// Export all endpoints
export * from "./create";
export * from "./list";
export * from "./update";
export * from "./delete";
export * from "./occupancy";
export * from "./subscribe_realtime";