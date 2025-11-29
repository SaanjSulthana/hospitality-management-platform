import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload } from "./events";
import { bufferFinanceEvent } from "./realtime_buffer";

// Fan-out subscriber: pushes events into per-org in-memory buffers
export const financeRealtimeSubscriber = new Subscription(
  financeEvents,
  "finance-realtime-subscriber",
  {
    handler: async (event: FinanceEventPayload) => {
      try {
        bufferFinanceEvent(event);
      } catch (error) {
        console.error("[FinanceRealtime] Failed to buffer event:", {
          error,
          eventType: event.eventType,
          orgId: event.orgId,
          entityId: event.entityId,
        });
        throw error; // ensure Encore retries if buffering throws
      }
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


