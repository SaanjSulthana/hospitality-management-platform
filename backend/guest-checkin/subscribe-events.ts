import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";

import { guestCheckinDB } from "./db";

export interface SubscribeGuestCheckinEventsRequest {
  /**
   * ISO timestamp of the last received event.
   * When omitted, events from the last 30 seconds are considered.
   */
  lastEventId?: string;
}

export type GuestCheckinEventType = "guest_checkins_changed";

export interface GuestCheckinEvent {
  eventType: GuestCheckinEventType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SubscribeGuestCheckinEventsResponse {
  events: GuestCheckinEvent[];
  lastEventId: string;
}

const DEFAULT_LOOKBACK_MS = 30_000;

/**
 * Lightweight long-poll endpoint that lets the frontend know when guest check-ins
 * have changed (created/updated). This provides a future-proof hook that can later
 * be swapped for SSE/WebSocket without touching consumers.
 */
export const subscribeGuestCheckinEvents = api<
  SubscribeGuestCheckinEventsRequest,
  SubscribeGuestCheckinEventsResponse
>(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/v1/guest-checkin/events/subscribe",
  },
  async (req) => {
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
        SELECT
          SUM(CASE WHEN created_at > ${since} THEN 1 ELSE 0 END) AS created_count,
          SUM(CASE WHEN updated_at > ${since} THEN 1 ELSE 0 END) AS updated_count
        FROM guest_checkins
        WHERE org_id = ${auth.orgId}
      `;

      const createdCount = parseInt(results?.created_count ?? "0", 10) || 0;
      const updatedCount = parseInt(results?.updated_count ?? "0", 10) || 0;
      const hasChanges = createdCount + updatedCount > 0;

      const events: GuestCheckinEvent[] = hasChanges
        ? [
            {
              eventType: "guest_checkins_changed",
              timestamp: new Date().toISOString(),
              metadata: {
                createdCount,
                updatedCount,
              },
            },
          ]
        : [];

      // Small delay to mimic subscription behaviour and avoid hammering the DB.
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
      log.error("Failed to subscribe to guest check-in events", {
        error: error instanceof Error ? error.message : String(error),
        orgId: auth.orgId,
      });
      throw error;
    }
  }
);


