import { Topic } from "encore.dev/pubsub";

export type PropertyEventType =
  | "property_created"
  | "property_updated"
  | "property_deleted";

export interface PropertyEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: PropertyEventType;
  orgId: number;
  propertyId: number;
  userId?: number;
  timestamp: Date;
  entityId: number; // property id
  entityType: "property";
  metadata?: Record<string, any>;
}

export const propertyEvents = new Topic<PropertyEventPayload>("property-events", {
  deliveryGuarantee: "at-least-once",
});


