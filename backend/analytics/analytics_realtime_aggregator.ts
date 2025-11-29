import { Subscription } from "encore.dev/pubsub";
import { analyticsEvents, type AnalyticsEventPayload } from "./events";
import { taskEvents, type TaskEventPayload } from "../tasks/events";
import { staffEvents, type StaffEventPayload } from "../staff/events";
import { propertyEvents, type PropertyEventPayload } from "../properties/events";
import { usersEvents, type UsersEventPayload } from "../users/events";
import { financeEvents, type FinanceEventPayload } from "../finance/events";
import { v4 as uuidv4 } from "uuid";

function toAnalyticsEvent(from: any): AnalyticsEventPayload {
  const eventId: string = from?.eventId || uuidv4();
  const timestamp: Date = from?.timestamp ? new Date(from.timestamp) : new Date();
  const orgId: number = from?.orgId ?? 0;
  const propertyId: number | null | undefined = from?.propertyId ?? from?.metadata?.propertyId ?? null;
  const entityId: number | string | null = from?.entityId ?? null;
  const entityType: string = from?.entityType || "unknown";
  const userId: number | null = (from?.userId as number) ?? null;
  const eventType: string = String(from?.eventType || "unknown");
  const metadata: Record<string, any> | undefined = from?.metadata || undefined;
  return {
    eventId,
    eventVersion: "v1",
    eventType,
    orgId,
    propertyId,
    userId,
    timestamp,
    entityId,
    entityType,
    metadata,
  };
}

export const analyticsFromTasks = new Subscription(
  taskEvents,
  "analytics-aggregate-from-tasks",
  {
    handler: async (event: TaskEventPayload) => {
      await analyticsEvents.publish(toAnalyticsEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const analyticsFromStaff = new Subscription(
  staffEvents,
  "analytics-aggregate-from-staff",
  {
    handler: async (event: StaffEventPayload) => {
      await analyticsEvents.publish(toAnalyticsEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const analyticsFromProperties = new Subscription(
  propertyEvents,
  "analytics-aggregate-from-properties",
  {
    handler: async (event: PropertyEventPayload) => {
      await analyticsEvents.publish(toAnalyticsEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const analyticsFromUsers = new Subscription(
  usersEvents,
  "analytics-aggregate-from-users",
  {
    handler: async (event: UsersEventPayload) => {
      await analyticsEvents.publish(toAnalyticsEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const analyticsFromFinance = new Subscription(
  financeEvents,
  "analytics-aggregate-from-finance",
  {
    handler: async (event: FinanceEventPayload) => {
      await analyticsEvents.publish(toAnalyticsEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


