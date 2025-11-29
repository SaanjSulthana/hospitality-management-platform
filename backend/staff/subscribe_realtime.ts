import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { api as encoreApi } from "encore.dev/api";
import { waitForEvents, getEventsSince } from "./realtime_buffer";
import { StaffEventPayload } from "./events";

export interface StaffRealtimeSubscribeRequest {
  lastEventId?: string; // ISO timestamp string of last received event
  propertyId?: number;
}

export interface StaffRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: StaffEventPayload[];
  lastEventId: string; // ISO of latest event timestamp returned (or echoed back)
}

async function subscribeStaffRealtimeHandler(req: StaffRealtimeSubscribeRequest): Promise<StaffRealtimeSubscribeResponse> {
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
      let events = getEventsSince(auth.orgId, req.lastEventId, req.propertyId);
      if (events.length === 0) {
        events = await waitForEvents(auth.orgId, req.lastEventId, req.propertyId);
      }

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
      console.error("[StaffRealtimeSubscribe][failure]", {
        ...ctx,
        error: (err && err.message) || String(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    } finally {
      const duration = Date.now() - startedAt;
      if (duration > 0) {
        console.log("[StaffRealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
      }
    }
  }

export const subscribeStaffRealtime = api<StaffRealtimeSubscribeRequest, StaffRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/realtime/subscribe" },
  subscribeStaffRealtimeHandler
);

export const subscribeStaffRealtimeV1 = api<StaffRealtimeSubscribeRequest, StaffRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/staff/realtime/subscribe" },
  subscribeStaffRealtimeHandler
);


