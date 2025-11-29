import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { GuestEventPayload, GuestEventType } from "./guest-checkin-events";

type Counter = {
	count: number;
	lastEventId?: string;
	lastEventType?: GuestEventType;
	lastEventAt?: string;
};

const publishedCounters = new Map<GuestEventType, Counter>();
const deliveredCounters = new Map<GuestEventType, Counter>();

function incrementCounter(map: Map<GuestEventType, Counter>, event: GuestEventPayload): void {
	const existing = map.get(event.eventType) ?? { count: 0 };
	const now = new Date().toISOString();
	map.set(event.eventType, {
		count: existing.count + 1,
		lastEventId: event.eventId,
		lastEventType: event.eventType,
		lastEventAt: now,
	});
}

export function recordGuestEventPublished(event: GuestEventPayload): void {
	incrementCounter(publishedCounters, event);
}

export function recordGuestEventsDelivered(events: GuestEventPayload[]): void {
	events.forEach((event) => incrementCounter(deliveredCounters, event));
}

function serializeCounters(map: Map<GuestEventType, Counter>): Record<string, Counter> {
	const result: Record<string, Counter> = {};
	for (const [eventType, counter] of map.entries()) {
		result[eventType] = counter;
	}
	return result;
}

interface GuestEventMetricsResponse {
	published: Record<string, Counter>;
	delivered: Record<string, Counter>;
}

async function getGuestEventMetricsHandler(): Promise<GuestEventMetricsResponse> {
	const auth = getAuthData();
	if (!auth) {
		throw new Error("Authentication required");
	}
	// Restrict to admins/managers
	if (!["ADMIN", "OWNER", "MANAGER"].includes(auth.role)) {
		throw new Error("Insufficient permissions");
	}

	return {
		published: serializeCounters(publishedCounters),
		delivered: serializeCounters(deliveredCounters),
	};
}

// Legacy endpoint
export const getGuestEventMetrics = api<void, GuestEventMetricsResponse>(
	{ expose: true, method: "GET", path: "/guest-checkin/events/metrics", auth: true },
	getGuestEventMetricsHandler
);

// V1 endpoint
export const getGuestEventMetricsV1 = api<void, GuestEventMetricsResponse>(
	{ expose: true, method: "GET", path: "/v1/guest-checkin/events/metrics", auth: true },
	getGuestEventMetricsHandler
);


