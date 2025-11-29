import { Subscription } from "encore.dev/pubsub";
import { auditEvents, type AuditEventPayload } from "./audit-events";
import { bufferAuditEvent } from "./subscribe-audit-events-v2";

// Fanout audit events to each instance's local buffer to enable
// immediate UI updates across replicas.
export const auditEventsBufferSubscriber = new Subscription(
	auditEvents,
	"audit-events-buffer",
	{
		handler: async (event: AuditEventPayload) => {
			// Push into in-memory buffer used by the long-poll endpoint
			bufferAuditEvent(event);
		},
		ackDeadline: "30s",
		maxConcurrency: 1000,
	}
);


