import { Service } from "encore.dev/service";

export default new Service("guest-checkin");

// Export all endpoints
export * from "./create";
export * from "./list";
export * from "./get";
export * from "./update";
export * from "./checkout";
export * from "./delete";
export * from "./stats";
export * from "./verify-schema";
export * from "./documents";
export * from "./serve-documents";
export * from "./document-stats";
export * from "./audit-logs";
export * from "./audit-actions";
export * from "./create-with-documents";
export * from "./debug-documents";
export * from "./extract-only";
export * from "./generate-c-form";
// export * from "./upload-formdata"; // Disabled - needs refactoring

// Real-time (side-effect imports register subscriptions)
import "./audit_events_subscriber";
import "./guest_checkin_events_subscriber";
export * from "./subscribe-audit-events-v2";
export * from "./subscribe-guest-events-v2";
export * from "./audit-events";
export * from "./guest-checkin-events";
export * from "./event-metrics";