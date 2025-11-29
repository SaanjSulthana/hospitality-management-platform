import { Subscription } from "encore.dev/pubsub";
import { dashboardEvents, type DashboardEventPayload } from "./events";
import { bufferDashboardEvent } from "./realtime_buffer";

export const dashboardRealtimeSubscriber = new Subscription(
  dashboardEvents,
  "dashboard-realtime-subscriber",
  {
    handler: async (event: DashboardEventPayload) => {
      try {
        bufferDashboardEvent(event);
      } catch (error) {
        console.error("[DashboardRealtime] Failed to buffer event:", {
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


