import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";
import type { GuestEventPayload } from "./guest-checkin-events";
import { recordGuestEventsDelivered } from "./event-metrics";
import { subscribe } from "./realtime_buffer";

// DEPRECATED: Old buffer - kept for backwards compatibility
// New implementation uses realtime_buffer.ts with waiter pattern
const orgGuestBuffers = new Map<number, GuestEventPayload[]>();
const MAX_BUFFER_SIZE = 200;
const MAX_WAIT_MS = 25000; // 25s (client should timeout ~30s)

// DEPRECATED: Use realtime_buffer pushEvent instead
export function bufferGuestEvent(event: GuestEventPayload): void {
	const orgId = Number(event.orgId);
	if (!Number.isFinite(orgId)) {
		log.warn("Skipping guest event buffering due to invalid orgId", {
			orgId: event.orgId,
			eventType: event.eventType,
		});
		return;
	}

	const normalized: GuestEventPayload = {
		...event,
		orgId,
		timestamp: event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp),
	};

	const buf = orgGuestBuffers.get(orgId) || [];
	buf.push(normalized);
	if (buf.length > MAX_BUFFER_SIZE) {
		log.warn("Guest buffer full, dropping oldest event", {
			orgId,
			max: MAX_BUFFER_SIZE,
		});
		buf.shift();
	}
	orgGuestBuffers.set(orgId, buf);

	log.info("Guest event buffered (old buffer - deprecated)", {
		orgId,
		eventType: event.eventType,
		entityId: event.entityId,
		bufferSize: buf.length,
	});
}

export interface SubscribeGuestEventsRequest {
	lastEventId?: string;
}

export interface SubscribeGuestEventsResponse {
	events: Array<{
		eventType: string;
		timestamp: string;
		entityId: number;
		entityType: string;
		metadata?: Record<string, unknown>;
	}>;
	lastEventId: string;
}

export const subscribeGuestEventsV2 = api<
	SubscribeGuestEventsRequest,
	SubscribeGuestEventsResponse
>(
	{
		auth: true,
		expose: true,
		method: "GET",
		path: "/v1/guest-checkin/realtime/subscribe",
	},
	async (req) => {
		const auth = getAuthData();
		if (!auth) throw new Error("Authentication required");

		const orgId = Number(auth.orgId);
		if (!Number.isFinite(orgId)) {
			throw new Error("Invalid organization");
		}

		const startTime = Date.now();

		log.info("Guest events long-poll started (V2 - using new buffer)", {
			orgId,
			lastEventId: req.lastEventId,
		});

		try {
			// Use NEW waiter pattern buffer instead of polling old buffer
			const events = await subscribe(orgId, undefined, MAX_WAIT_MS);
			
			const durationMs = Date.now() - startTime;

			if (events.length > 0) {
				const latest = events[events.length - 1];

				log.info("Guest events delivered (V2)", {
					orgId,
					eventCount: events.length,
					firstEventType: events[0]?.eventType,
					durationMs,
				});

				recordGuestEventsDelivered(events);

				return {
					events: events.map((e) => ({
						eventType: e.eventType,
						timestamp: e.timestamp.toISOString(),
						entityId: e.entityId,
						entityType: e.entityType,
						metadata: e.metadata as Record<string, unknown> | undefined,
					})),
					lastEventId: latest.timestamp.toISOString(),
				};
			}

			// Timeout: return empty response
			log.info("Guest events long-poll timeout (V2)", {
				orgId,
				durationMs,
			});

			return {
				events: [],
				lastEventId: req.lastEventId || new Date().toISOString(),
			};

		} catch (error) {
			const durationMs = Date.now() - startTime;
			
			log.error("Guest events subscribe error (V2)", {
				orgId,
				durationMs,
				error: String(error),
			});

			throw new Error("Failed to subscribe to guest events");
		}
	}
);


