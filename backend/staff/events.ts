import { Topic } from "encore.dev/pubsub";

export type StaffEntityType =
  | "staff"
  | "schedule"
  | "schedule_change_request"
  | "leave"
  | "attendance"
  | "salary_component"
  | "payslip";

export type StaffEventType =
  | "staff_created"
  | "staff_updated"
  | "staff_deleted"
  | "schedule_created"
  | "schedule_updated"
  | "schedule_deleted"
  | "schedule_change_request_created"
  | "schedule_change_request_approved"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"
  | "attendance_checked_in"
  | "attendance_checked_out"
  | "attendance_updated"
  | "salary_component_added"
  | "salary_component_updated"
  | "salary_component_deleted"
  | "payslip_generated";

export interface StaffEventPayload {
  eventId: string; // UUID
  eventVersion: "v1";
  eventType: StaffEventType;
  orgId: number;
  propertyId?: number | null;
  userId?: number;
  timestamp: Date;
  entityId: number;
  entityType: StaffEntityType;
  metadata?: Record<string, any>;
}

export const staffEvents = new Topic<StaffEventPayload>("staff-events", {
  deliveryGuarantee: "at-least-once",
});


