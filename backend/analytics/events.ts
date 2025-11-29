import { Topic } from "encore.dev/pubsub";

export interface AnalyticsEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: string; // passthrough from source services
  orgId: number;
  propertyId?: number | null;
  userId?: number | null;
  timestamp: Date;
  entityId?: number | string | null;
  entityType: string; // e.g. "finance" | "task" | "staff" | "property" | "user"
  metadata?: Record<string, any>;
}

export const analyticsEvents = new Topic<AnalyticsEventPayload>("analytics-events", {
  deliveryGuarantee: "at-least-once",
});


