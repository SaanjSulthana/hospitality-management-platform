import { Subscription } from "encore.dev/pubsub";
import { taskEvents, TaskEventPayload } from "./events";
import { bufferTaskEvent } from "./realtime_buffer";

export const tasksRealtimeSubscriber = new Subscription(
  taskEvents,
  "tasks-realtime-subscriber",
  {
    handler: async (event: TaskEventPayload) => {
      try {
        bufferTaskEvent(event);
      } catch (error) {
        console.error("[TasksRealtime] Failed to buffer event:", {
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


