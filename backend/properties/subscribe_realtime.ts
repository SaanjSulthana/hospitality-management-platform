import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { api as encoreApi } from "encore.dev/api";
import { getEventsSince, waitForEvents } from "./realtime_buffer";
import { PropertyEventPayload } from "./events";

export interface PropertiesRealtimeSubscribeRequest {
  lastEventId?: string;
  propertyId?: number;
}

export interface PropertiesRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: PropertyEventPayload[];
  lastEventId: string;
}

async function subscribePropertiesRealtimeHandler(req: PropertiesRealtimeSubscribeRequest): Promise<PropertiesRealtimeSubscribeResponse> {
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
      console.error("[PropertiesRealtimeSubscribe][failure]", {
        ...ctx,
        error: (err && err.message) || String(err),
        durationMs: Date.now() - startedAt,
      });
      throw err;
    } finally {
      const duration = Date.now() - startedAt;
      if (duration > 0) {
        console.log("[PropertiesRealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
      }
    }
  }

export const subscribePropertiesRealtime = api<PropertiesRealtimeSubscribeRequest, PropertiesRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/properties/realtime/subscribe" },
  subscribePropertiesRealtimeHandler
);

export const subscribePropertiesRealtimeV1 = api<PropertiesRealtimeSubscribeRequest, PropertiesRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/properties/realtime/subscribe" },
  subscribePropertiesRealtimeHandler
);


