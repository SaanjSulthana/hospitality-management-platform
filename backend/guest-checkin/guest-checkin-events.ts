import { Topic } from "encore.dev/pubsub";

export type GuestEventType =
	| "guest_created"
	| "guest_updated"
	| "guest_checked_out"
	| "guest_deleted"
	| "guest_document_uploaded"
	| "guest_document_extracted"
	| "guest_document_extract_failed";

export interface GuestEventPayload {
	eventId: string;
	eventVersion: "v1";
	eventType: GuestEventType;
	orgId: number;
	propertyId: number;
	userId: number;
	timestamp: Date;
	entityType: "guest_checkin" | "guest_document";
	entityId: number; // guestCheckInId
	metadata?: {
		action?: "add" | "update" | "delete";
		guestName?: string;
		documentType?: string;
		status?: "processing" | "ready" | "failed";
		reason?: string;
		documentId?: number;
		filename?: string;
		thumbnailUrl?: string;
		overallConfidence?: number;
		fieldsExtracted?: number;
		updatedFields?: string[];
	};
}

// Primary topic for guest check-in related changes
export const guestCheckinEvents = new Topic<GuestEventPayload>("guest-checkin-events", {
	deliveryGuarantee: "at-least-once",
});


