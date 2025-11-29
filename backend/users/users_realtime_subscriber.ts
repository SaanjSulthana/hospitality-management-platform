import { Subscription } from "encore.dev/pubsub";
import { usersEvents, UsersEventPayload } from "./events";
import { bufferUsersEvent } from "./realtime_buffer";

export const usersRealtimeSubscriber = new Subscription(
  usersEvents,
  "users-realtime-subscriber",
  {
    handler: async (event: UsersEventPayload) => {
      try {
        bufferUsersEvent(event);
      } catch (error) {
        console.error("[UsersRealtime] Failed to buffer event:", {
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


