import { Topic } from "encore.dev/pubsub";

export type UsersEventType =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_properties_assigned"
  | "user_login"
  | "user_logout";

export interface UsersEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: UsersEventType;
  orgId: number;
  propertyId?: number | null; // optional; users are org-scoped
  userId?: number; // actor
  timestamp: Date;
  entityId: number; // affected user id
  entityType: "user";
  metadata?: Record<string, any>;
}

export const usersEvents = new Topic<UsersEventPayload>("users-events", {
  deliveryGuarantee: "at-least-once",
});


