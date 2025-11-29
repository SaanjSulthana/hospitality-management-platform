import { Subscription } from "encore.dev/pubsub";
import { staffEvents, StaffEventPayload } from "./events";
import { bufferStaffEvent } from "./realtime_buffer";

export const staffRealtimeSubscriber = new Subscription(
  staffEvents,
  "staff-realtime-subscriber",
  {
    handler: async (event: StaffEventPayload) => {
      try {
        bufferStaffEvent(event);
      } catch (error) {
        console.error("[StaffRealtime] Failed to buffer event:", {
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


