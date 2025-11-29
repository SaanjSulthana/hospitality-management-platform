/**
 * DEPRECATED: This subscriber has been replaced by realtime_subscriber.ts
 * 
 * The new subscriber uses a waiter pattern for instant notifications
 * instead of polling loops. This file is kept for reference only.
 * 
 * To re-enable old subscriber: Uncomment the export below
 * To fully migrate: Delete this file after V3 is stable
 */

import { Subscription } from "encore.dev/pubsub";
import { guestCheckinEvents, type GuestEventPayload } from "./guest-checkin-events";
import { pushEvent } from "./realtime_buffer";

// MIGRATED TO: backend/guest-checkin/realtime_subscriber.ts
// Using new waiter pattern buffer for instant notifications

export const guestCheckinEventsBufferSubscriber = new Subscription(
	guestCheckinEvents,
	"guest-checkin-realtime-buffer-v3",  // Changed name to avoid conflict
	{
		handler: async (event: GuestEventPayload) => {
			// NEW: Use waiter pattern buffer (instant wake-up)
			pushEvent(event.orgId, event.propertyId, event);
		},
		ackDeadline: "30s",
		maxConcurrency: 1000,
	}
);
