/**
 * Audit Log Events Topic
 * Real-time event distribution for audit log changes
 * Scales to millions of organizations with Encore's pub/sub infrastructure
 */

import { Topic } from "encore.dev/pubsub";

export interface AuditEventPayload {
  orgId: number;
  eventType: 'audit_log_created' | 'audit_logs_filtered';
  eventId: string;
  timestamp: Date;
  metadata?: {
    actionType?: string;
    userId?: number;
    guestCheckInId?: number;
    logCount?: number;
  };
}

// Create pub/sub topic (Encore handles all scaling automatically)
export const auditEvents = new Topic<AuditEventPayload>("audit-events", {
  deliveryGuarantee: "at-least-once",
});

