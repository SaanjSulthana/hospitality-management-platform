import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { v1Path } from "../shared/http";

export interface SubscribeAuditEventsRequest {
  /**
   * ISO timestamp of the last received event.
   * When omitted, events from the last 30 seconds are considered.
   */
  lastEventId?: string;
}

export type AuditEventType = "audit_logs_changed";

export interface AuditEvent {
  eventType: AuditEventType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SubscribeAuditEventsResponse {
  events: AuditEvent[];
  lastEventId: string;
}

const DEFAULT_LOOKBACK_MS = 30_000;

/**
 * Lightweight long-poll endpoint that notifies frontend when audit logs have changed.
 * This replaces inefficient tab-switch polling with event-driven updates.
 */
async function subscribeAuditEventsHandler(req: SubscribeAuditEventsRequest): Promise<SubscribeAuditEventsResponse> {
    const auth = getAuthData();

    if (!auth) {
      throw new Error("Authentication required");
    }

    const since =
      (req.lastEventId && !Number.isNaN(Date.parse(req.lastEventId))
        ? new Date(req.lastEventId)
        : undefined) ??
      new Date(Date.now() - DEFAULT_LOOKBACK_MS);

    try {
      const results = await guestCheckinDB.queryRow`
        SELECT COUNT(*) AS new_count
        FROM guest_audit_logs
        WHERE org_id = ${auth.orgId}
          AND timestamp > ${since}
      `;

      const newCount = parseInt(results?.new_count ?? "0", 10) || 0;
      const hasChanges = newCount > 0;

      const events: AuditEvent[] = hasChanges
        ? [
            {
              eventType: "audit_logs_changed",
              timestamp: new Date().toISOString(),
              metadata: {
                newCount,
              },
            },
          ]
        : [];

      // Small delay to mimic subscription behavior and avoid hammering the DB
      await new Promise((resolve) => setTimeout(resolve, 100));

      const lastEventId =
        events[events.length - 1]?.timestamp ??
        req.lastEventId ??
        new Date().toISOString();

      return {
        events,
        lastEventId,
      };
    } catch (error) {
      log.error("Failed to subscribe to audit events", {
        error: error instanceof Error ? error.message : String(error),
        orgId: auth.orgId,
      });
      throw error;
    }
}

// LEGACY: Lightweight long-poll endpoint (simple COUNT-based polling, keep for backward compatibility)
// NOTE: This is deprecated in favor of subscribeAuditEventsV2 which provides actual event data
export const subscribeAuditEvents = api<
  SubscribeAuditEventsRequest,
  SubscribeAuditEventsResponse
>(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/guest-checkin/audit-events/subscribe",
  },
  subscribeAuditEventsHandler
);

// V1: Lightweight long-poll endpoint (simple COUNT-based polling)
// NOTE: subscribeAuditEventsV2 is the recommended endpoint with actual event data
export const subscribeAuditEventsV1 = api<
  SubscribeAuditEventsRequest,
  SubscribeAuditEventsResponse
>(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/v1/guest-checkin/audit-events/subscribe-simple",
  },
  subscribeAuditEventsHandler
);

