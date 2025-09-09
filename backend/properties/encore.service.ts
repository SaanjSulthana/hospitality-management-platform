import { Service } from "encore.dev/service";

export default new Service("properties");

// Export all endpoints
export * from "./create";
export * from "./list";
export * from "./update";
export * from "./delete";
export * from "./occupancy";