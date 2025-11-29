import { Subscription } from "encore.dev/pubsub";
import { financeEvents, FinanceEventPayload } from "./events";
import { persistEvent } from "./event_store.js";

// Subscription handler for finance events
// This creates a subscription that processes finance events according to Encore.js docs
export const financeEventsHandler = new Subscription(financeEvents, "finance-events-handler", {
  handler: async (event: FinanceEventPayload) => {
    console.log('[Finance] Event received:', {
      eventId: event.eventId,
      eventType: event.eventType,
      orgId: event.orgId
    });
    
    try {
      // Persist to event store for audit trail
      await persistEvent(event);
      
      console.log('[Finance] Event persisted:', event.eventId);
    } catch (error) {
      console.error('[Finance] Error persisting event:', error);
      // Let Encore retry
      throw error;
    }
  },
  ackDeadline: "30s",
  maxConcurrency: 500
});
