import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { waitForEvents, getEventsSince } from "./realtime_buffer";
import { FinanceEventPayload } from "./events";
import { api as encoreApi } from "encore.dev/api";
import { v1Path } from "../shared/http";

export interface FinanceRealtimeSubscribeRequest {
  lastEventId?: string; // ISO timestamp string of last received event
  propertyId?: number;
}

export interface FinanceRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: FinanceEventPayload[];
  lastEventId: string; // ISO of latest event timestamp returned (or echoed back)
}

// Long-poll endpoint that drains per-org buffers.
// Mirrors Guest Check-In strategy; returns quickly if events available,
// otherwise waits up to LONG_POLL_TIMEOUT_MS.
async function subscribeFinanceRealtimeHandler(req: FinanceRealtimeSubscribeRequest): Promise<FinanceRealtimeSubscribeResponse> {
    const auth = getAuthData();
    if (!auth) {
      throw new Error("Authentication required");
    }

    const startedAt = Date.now();
    const origin = (encoreApi as any)?.requestHeaders?.get?.("origin") || "";
    const userAgent = (encoreApi as any)?.requestHeaders?.get?.("user-agent") || "";
    const ctx = {
      orgId: (auth as any).orgId,
      userId: (auth as any).userID,
      propertyId: req.propertyId ?? null,
      lastEventId: req.lastEventId ?? "",
      origin,
      ua: userAgent?.slice(0, 80) || "",
    };

    try {
      // First, see if there are already events available
      let events = getEventsSince(auth.orgId, req.lastEventId, req.propertyId);

      // If none, long-poll until available or timeout
      if (events.length === 0) {
        events = await waitForEvents(auth.orgId, req.lastEventId, req.propertyId);
      }

      // Determine new lastEventId based on the latest event timestamp
      const newLastEventId =
        events.length > 0
          ? events[events.length - 1].timestamp.toISOString()
          : req.lastEventId || "";

      return {
        schemaVersion: 1,
        events,
        lastEventId: newLastEventId,
      };
    } catch (err: any) {
      // Context-only failure tags for observability (no PII beyond org/user ids already known server-side)
      console.error("[RealtimeSubscribe][failure]", {
        ...ctx,
        error: (err && err.message) || String(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    } finally {
      const duration = Date.now() - startedAt;
      if (duration > 0) {
        console.log("[RealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
      }
    }
  }

// Legacy path
export const subscribeFinanceRealtime = api<FinanceRealtimeSubscribeRequest, FinanceRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/realtime/subscribe" },
  subscribeFinanceRealtimeHandler
);

// Versioned path
export const subscribeFinanceRealtimeV1 = api<FinanceRealtimeSubscribeRequest, FinanceRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/realtime/subscribe" },
  subscribeFinanceRealtimeHandler
);


