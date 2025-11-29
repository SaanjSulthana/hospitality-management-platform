import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { api as encoreApi } from "encore.dev/api";
import { getEventsSince, waitForEvents } from "./realtime_buffer";
import type { AnalyticsEventPayload } from "./events";

export interface AnalyticsRealtimeSubscribeRequest {
  lastEventId?: string;
  propertyId?: number;
}

export interface AnalyticsRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: AnalyticsEventPayload[];
  lastEventId: string;
}

async function subscribeAnalyticsRealtimeHandler(
  req: AnalyticsRealtimeSubscribeRequest
): Promise<AnalyticsRealtimeSubscribeResponse> {
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
    console.error("[AnalyticsRealtimeSubscribe][failure]", {
      ...ctx,
      error: (err && err.message) || String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    const duration = Date.now() - startedAt;
    if (duration > 0) {
      console.log("[AnalyticsRealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
    }
  }
}

export const subscribeAnalyticsRealtime = api<AnalyticsRealtimeSubscribeRequest, AnalyticsRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/analytics/realtime/subscribe" },
  subscribeAnalyticsRealtimeHandler
);

export const subscribeAnalyticsRealtimeV1 = api<AnalyticsRealtimeSubscribeRequest, AnalyticsRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/analytics/realtime/subscribe" },
  subscribeAnalyticsRealtimeHandler
);


