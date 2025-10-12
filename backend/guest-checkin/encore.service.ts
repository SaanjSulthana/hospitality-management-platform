import { Service } from "encore.dev/service";

export default new Service("guest-checkin");

// Export all endpoints
export * from "./create";
export * from "./list";
export * from "./get";
export * from "./checkout";
export * from "./delete";
export * from "./stats";
export * from "./verify-schema";
export * from "./documents";
export * from "./serve-documents";
export * from "./document-stats";
export * from "./audit-logs";
export * from "./create-with-documents";
export * from "./debug-documents";
// export * from "./upload-formdata"; // Disabled - needs refactoring
