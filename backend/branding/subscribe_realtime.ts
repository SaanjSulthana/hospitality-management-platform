import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { api as encoreApi } from "encore.dev/api";
import { getEventsSince, waitForEvents } from "./realtime_buffer";
import type { BrandingEventPayload } from "./events";

export interface BrandingRealtimeSubscribeRequest {
  lastEventId?: string;
}

export interface BrandingRealtimeSubscribeResponse {
  schemaVersion?: number;
  events: BrandingEventPayload[];
  lastEventId: string;
}

async function subscribeBrandingRealtimeHandler(
  req: BrandingRealtimeSubscribeRequest
): Promise<BrandingRealtimeSubscribeResponse> {
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
    lastEventId: req.lastEventId ?? "",
    origin,
    ua: userAgent?.slice(0, 80) || "",
  };
  try {
    let events = getEventsSince(auth.orgId, req.lastEventId);
    if (events.length === 0) {
      events = await waitForEvents(auth.orgId, req.lastEventId);
    }
    const newLastEventId =
      events.length > 0 ? events[events.length - 1].timestamp.toISOString() : req.lastEventId || "";
    return { schemaVersion: 1, events, lastEventId: newLastEventId };
  } catch (err: any) {
    console.error("[BrandingRealtimeSubscribe][failure]", {
      ...ctx,
      error: (err && err.message) || String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    const duration = Date.now() - startedAt;
    if (duration > 0) {
      console.log("[BrandingRealtimeSubscribe][completed]", { ...ctx, durationMs: duration });
    }
  }
}

export const subscribeBrandingRealtime = api<BrandingRealtimeSubscribeRequest, BrandingRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/branding/realtime/subscribe" },
  subscribeBrandingRealtimeHandler
);

export const subscribeBrandingRealtimeV1 = api<BrandingRealtimeSubscribeRequest, BrandingRealtimeSubscribeResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/branding/realtime/subscribe" },
  subscribeBrandingRealtimeHandler
);


