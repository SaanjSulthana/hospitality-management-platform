import { Topic } from "encore.dev/pubsub";

export type TaskEventType =
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_assigned"
  | "task_status_updated"
  | "task_hours_updated"
  | "task_attachment_added";

export interface TaskEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: TaskEventType;
  orgId: number;
  propertyId: number;
  userId?: number; // actor
  timestamp: Date;
  entityId: number; // task id
  entityType: "task";
  metadata?: Record<string, any>;
}

export const taskEvents = new Topic<TaskEventPayload>("task-events", {
  deliveryGuarantee: "at-least-once",
});


