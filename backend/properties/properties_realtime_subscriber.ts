import { Subscription } from "encore.dev/pubsub";
import { propertyEvents, PropertyEventPayload } from "./events";
import { bufferPropertyEvent } from "./realtime_buffer";

export const propertiesRealtimeSubscriber = new Subscription(
  propertyEvents,
  "properties-realtime-subscriber",
  {
    handler: async (event: PropertyEventPayload) => {
      try {
        bufferPropertyEvent(event);
      } catch (error) {
        console.error("[PropertiesRealtime] Failed to buffer event:", {
          error,
          eventType: event.eventType,
          orgId: event.orgId,
          entityId: event.entityId,
        });
        throw error;
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


