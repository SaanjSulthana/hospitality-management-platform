import { Topic } from "encore.dev/pubsub";

export type BrandingEventType =
  | "theme_updated"
  | "logo_uploaded"
  | "theme_cleaned";

export interface BrandingEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: BrandingEventType;
  orgId: number;
  propertyId?: number | null; // generally null for org-wide settings
  userId?: number | null;
  timestamp: Date;
  entityId: number; // use orgId
  entityType: "branding";
  metadata?: Record<string, any>;
}

export const brandingEvents = new Topic<BrandingEventPayload>("branding-events", {
  deliveryGuarantee: "at-least-once",
});


