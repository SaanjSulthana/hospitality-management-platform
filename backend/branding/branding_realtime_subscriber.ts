import { Subscription } from "encore.dev/pubsub";
import { brandingEvents, type BrandingEventPayload } from "./events";
import { bufferBrandingEvent } from "./realtime_buffer";

export const brandingRealtimeSubscriber = new Subscription(
  brandingEvents,
  "branding-realtime-subscriber",
  {
    handler: async (event: BrandingEventPayload) => {
      try {
        bufferBrandingEvent(event);
      } catch (error) {
        console.error("[BrandingRealtime] Failed to buffer event:", {
          error,
          eventType: event.eventType,
          orgId: event.orgId,
        });
        throw error;
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


