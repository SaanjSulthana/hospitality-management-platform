import { Subscription } from "encore.dev/pubsub";
import { dashboardEvents, type DashboardEventPayload } from "./events";
import { taskEvents, type TaskEventPayload } from "../tasks/events";
import { staffEvents, type StaffEventPayload } from "../staff/events";
import { propertyEvents, type PropertyEventPayload } from "../properties/events";
import { usersEvents, type UsersEventPayload } from "../users/events";
import { financeEvents, type FinanceEventPayload } from "../finance/events";
import { v4 as uuidv4 } from "uuid";

function toDashboardEvent(from: any): DashboardEventPayload {
  // Preserve original eventId if present, otherwise generate
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

export const dashboardFromTasks = new Subscription(
  taskEvents,
  "dashboard-aggregate-from-tasks",
  {
    handler: async (event: TaskEventPayload) => {
      await dashboardEvents.publish(toDashboardEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const dashboardFromStaff = new Subscription(
  staffEvents,
  "dashboard-aggregate-from-staff",
  {
    handler: async (event: StaffEventPayload) => {
      await dashboardEvents.publish(toDashboardEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const dashboardFromProperties = new Subscription(
  propertyEvents,
  "dashboard-aggregate-from-properties",
  {
    handler: async (event: PropertyEventPayload) => {
      await dashboardEvents.publish(toDashboardEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const dashboardFromUsers = new Subscription(
  usersEvents,
  "dashboard-aggregate-from-users",
  {
    handler: async (event: UsersEventPayload) => {
      await dashboardEvents.publish(toDashboardEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);

export const dashboardFromFinance = new Subscription(
  financeEvents,
  "dashboard-aggregate-from-finance",
  {
    handler: async (event: FinanceEventPayload) => {
      await dashboardEvents.publish(toDashboardEvent(event));
    },
    ackDeadline: "30s",
    maxConcurrency: 5000,
  }
);


