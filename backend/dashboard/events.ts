import { Topic } from "encore.dev/pubsub";

export interface DashboardEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: string; // passthrough from source services
  orgId: number;
  propertyId?: number | null;
  userId?: number | null;
  timestamp: Date;
  entityId?: number | string | null;
  entityType: string; // e.g. "task" | "staff" | "property" | "user" | "finance" | "guest" | "audit"
  metadata?: Record<string, any>;
}

export const dashboardEvents = new Topic<DashboardEventPayload>("dashboard-events", {
  deliveryGuarantee: "at-least-once",
});


