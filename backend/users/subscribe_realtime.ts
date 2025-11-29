import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { api as encoreApi } from "encore.dev/api";
import { getEventsSince, waitForEvents } from "./realtime_buffer";
import { UsersEventPayload } from "./events";

export interface UsersRealtimeSubscribeRequest {
  lastEventId?: string;
  propertyId?: number;
}

export interface UsersRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: UsersEventPayload[];
  lastEventId: string;
}

async function subscribeUsersRealtimeHandler(req: UsersRealtimeSubscribeRequest): Promise<UsersRealtimeSubscribeResponse> {
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
        events.length > 0 ? events[events.length - 1].timestamp.toISOString() : req.lastEventId || "";
      return { schemaVersion: 1, events, lastEventId: newLastEventId };
    } catch (err: any) {
      console.error("[UsersRealtimeSubscribe][failure]", {
        ...ctx,
        error: (err && err.message) || String(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    } finally {
      const duration = Date.now() - startedAt;
      if (duration > 0) {
        console.log("[UsersRealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
      }
    }
  }

export const subscribeUsersRealtime = api<UsersRealtimeSubscribeRequest, UsersRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/users/realtime/subscribe" },
  subscribeUsersRealtimeHandler
);

export const subscribeUsersRealtimeV1 = api<UsersRealtimeSubscribeRequest, UsersRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/users/realtime/subscribe" },
  subscribeUsersRealtimeHandler
);


