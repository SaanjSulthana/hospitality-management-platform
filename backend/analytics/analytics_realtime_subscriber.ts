import { Subscription } from "encore.dev/pubsub";
import { analyticsEvents, type AnalyticsEventPayload } from "./events";
import { bufferAnalyticsEvent } from "./realtime_buffer";

export const analyticsRealtimeSubscriber = new Subscription(
  analyticsEvents,
  "analytics-realtime-subscriber",
  {
    handler: async (event: AnalyticsEventPayload) => {
      try {
        bufferAnalyticsEvent(event);
      } catch (error) {
        console.error("[AnalyticsRealtime] Failed to buffer event:", {
          error,
          eventType: event.eventType,
          orgId: event.orgId,
          entityType: event.entityType,
          entityId: event.entityId,
        });
        throw error;
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


