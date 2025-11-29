/**
 * Unified Streaming API Endpoint (ENCORE-COMPATIBLE VERSION)
 * 
 * FIXES FOR ENCORE:
 * ✅ Static subscription names (not template literals)
 * ✅ Top-level subscription declarations
 * ✅ Object literal API errors
 * ✅ Single named interface for StreamOutMessage
 * ✅ No ReturnType utility type
 * 
 * Backpressure & Slow Consumers
 * -----------------------------
 * This service relies on the shared connection_pool to enforce backpressure.
 * The pool tracks per-connection queue size and will skip broadcasting to
 * slow consumers; after repeated warnings the connection is dropped. This
 * avoids unbounded memory growth when a client cannot keep up.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Subscription } from "encore.dev/pubsub";
import type {
  StreamHandshake,
  StreamMessage,
  StreamOutMessage,
  ServiceName,
} from "./types";

import { connectionPool } from "./connection_pool";

// Import all Pub/Sub topics
import { financeEvents } from "../finance/events";
import { guestCheckinEvents } from "../guest-checkin/guest-checkin-events";
import { staffEvents } from "../staff/events";
import { taskEvents } from "../tasks/events";
import { propertyEvents } from "../properties/events";
import { usersEvents } from "../users/events";
import { dashboardEvents } from "../dashboard/events";
import { brandingEvents } from "../branding/events";
import { analyticsEvents } from "../analytics/events";

/**
 * Configuration
 */
const CONFIG = {
  PING_INTERVAL_MS: 30_000,
  COMPRESSION_THRESHOLD: 1024,
  MISSED_EVENTS_WINDOW_MS: 300_000,
  MAX_MISSED_EVENTS: 1000,
  BATCH_WINDOW_MS: 50,
  MAX_BATCH_SIZE: 100,
  MAX_BACKOFF_MS: 300_000,
  JITTER_MS: 5000,
} as const;

/**
 * Global metrics (Enhanced)
 */
const metrics = {
  activeConnections: 0,
  totalConnections: 0,
  eventsDelivered: 0,
  eventsByService: {} as Record<ServiceName, number>,
  errorCount: 0,
  missedEventsReplayed: 0,
  eventsBuffered: 0,
  bufferCleanups: 0,
  slowClientsDetected: 0,
  batchesSent: 0,
};

/**
 * Recent events buffer for missed event replay
 */
interface RecentEvent {
  event: any;
  timestamp: number;
  seq: number;
}

const recentEventsBuffer = new Map<string, RecentEvent[]>();

/**
 * Global sequence counter per org per service
 */
const orgServiceSeq = new Map<string, number>();

/**
 * Periodic cleanup for event buffer (FIX: Memory leak)
 * Runs every minute to remove expired events and empty buffers
 */
setInterval(() => {
  const now = Date.now();
  const cutoff = now - CONFIG.MISSED_EVENTS_WINDOW_MS;
  
  for (const [key, buffer] of recentEventsBuffer.entries()) {
    const filtered = buffer.filter(e => e.timestamp > cutoff);
    
    if (filtered.length === 0) {
      recentEventsBuffer.delete(key); // Remove empty buffers
    } else if (filtered.length < buffer.length) {
      recentEventsBuffer.set(key, filtered);
    }
  }
  
  console.log("[UnifiedStream][cleanup]", {
    buffersActive: recentEventsBuffer.size,
    buffersRemoved: Array.from(recentEventsBuffer.keys()).length,
  });
}, 60_000); // Every minute

/**
 * Get next sequence number for org+service
 */
function getNextSeq(orgId: number, service: ServiceName): number {
  const key = `${orgId}-${service}`;
  const current = orgServiceSeq.get(key) || 0;
  const next = current + 1;
  orgServiceSeq.set(key, next);
  return next;
}

/**
 * Store event in recent buffer for replay
 */
function bufferRecentEvent(orgId: number, service: ServiceName, event: any, seq: number): void {
  const key = `${orgId}-${service}`;
  
  if (!recentEventsBuffer.has(key)) {
    recentEventsBuffer.set(key, []);
  }
  
  const buffer = recentEventsBuffer.get(key)!;
  buffer.push({ event, timestamp: Date.now(), seq });

  const now = Date.now();
  const cutoff = now - CONFIG.MISSED_EVENTS_WINDOW_MS;
  const filtered = buffer.filter(e => e.timestamp > cutoff);
  
  if (filtered.length > CONFIG.MAX_MISSED_EVENTS) {
    filtered.splice(0, filtered.length - CONFIG.MAX_MISSED_EVENTS);
  }
  
  recentEventsBuffer.set(key, filtered);
}

/**
 * Get missed events since lastSeq
 */
function getMissedEvents(orgId: number, service: ServiceName, lastSeq: number): RecentEvent[] {
  const key = `${orgId}-${service}`;
  const buffer = recentEventsBuffer.get(key) || [];
  return buffer.filter(e => e.seq > lastSeq);
}

/**
 * Event batching (FIX: Implement batching)
 */
interface EventBatch {
  events: any[];
  timer: NodeJS.Timeout;
}

const eventBatcher = new Map<string, EventBatch>();

/**
 * Flush a batch of events
 */
async function flushBatch(key: string): Promise<void> {
  const batch = eventBatcher.get(key);
  if (!batch || batch.events.length === 0) return;

  eventBatcher.delete(key);

  const [orgIdStr, service] = key.split('-');
  const orgId = parseInt(orgIdStr, 10);
  const seq = getNextSeq(orgId, service as ServiceName);

  // Create batch message
  const outMessage: StreamOutMessage = {
    type: "batch",
    service: service as ServiceName,
    events: batch.events,
    timestamp: new Date().toISOString(),
    seq,
    messages: batch.events.map((event, idx) => ({
      service: service as ServiceName,
      events: [event],
      timestamp: new Date().toISOString(),
      seq: seq + idx,
      type: "event" as const,
    })),
  };

  // Broadcast batch
  await connectionPool.broadcast(orgId, service as ServiceName, outMessage as any);

  metrics.eventsDelivered += batch.events.length;
  metrics.batchesSent++;
  metrics.eventsByService[service as ServiceName] = 
    (metrics.eventsByService[service as ServiceName] || 0) + batch.events.length;
}

/**
 * Create subscription handler for a service (Enhanced with batching)
 */
function createHandler(service: ServiceName) {
  return async (event: any) => {
    if (!event.orgId) return;
    
    const orgId = event.orgId;
    const seq = getNextSeq(orgId, service);
    
    // Buffer for missed event replay
    bufferRecentEvent(orgId, service, event, seq);

    // Add to batch (FIX: Event batching)
    const key = `${orgId}-${service}`;
    
    if (!eventBatcher.has(key)) {
      eventBatcher.set(key, {
        events: [],
        timer: setTimeout(() => flushBatch(key), CONFIG.BATCH_WINDOW_MS),
      });
    }

    const batch = eventBatcher.get(key)!;
    batch.events.push(event);

    // Flush if batch full
    if (batch.events.length >= CONFIG.MAX_BATCH_SIZE) {
      clearTimeout(batch.timer);
      await flushBatch(key);
    }
  };
}

/**
 * Encore Subscriptions - Declared at top level with static names
 * (Encore requires this pattern - no dynamic subscription creation)
 */
export const financeStreamSubscription = new Subscription(
  financeEvents,
  "unified-stream-finance",
  {
    handler: createHandler("finance"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const guestStreamSubscription = new Subscription(
  guestCheckinEvents,
  "unified-stream-guest",
  {
    handler: createHandler("guest"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const staffStreamSubscription = new Subscription(
  staffEvents,
  "unified-stream-staff",
  {
    handler: createHandler("staff"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const tasksStreamSubscription = new Subscription(
  taskEvents,
  "unified-stream-tasks",
  {
    handler: createHandler("tasks"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const propertiesStreamSubscription = new Subscription(
  propertyEvents,
  "unified-stream-properties",
  {
    handler: createHandler("properties"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const usersStreamSubscription = new Subscription(
  usersEvents,
  "unified-stream-users",
  {
    handler: createHandler("users"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const dashboardStreamSubscription = new Subscription(
  dashboardEvents,
  "unified-stream-dashboard",
  {
    handler: createHandler("dashboard"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const brandingStreamSubscription = new Subscription(
  brandingEvents,
  "unified-stream-branding",
  {
    handler: createHandler("branding"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const analyticsStreamSubscription = new Subscription(
  analyticsEvents,
  "unified-stream-analytics",
  {
    handler: createHandler("analytics"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

export const reportsStreamSubscription = new Subscription(
  financeEvents,
  "unified-stream-reports",
  {
    handler: createHandler("reports"),
    maxConcurrency: 1000,
    ackDeadline: "30s",
  }
);

/**
 * Main streaming endpoint
 */
export const streamRealtimeEvents = api.streamOut<StreamHandshake, StreamOutMessage>(
  {
    // Use Encore's standard auth so we can rely on getAuthData()
    auth: true,
    expose: true,
    path: "/v2/realtime/stream",
  },
  async (handshake, stream) => {
    try {
      // Use Encore's auth context (same as normal endpoints)
      const authData = getAuthData();
      if (!authData) {
        throw APIError.unauthenticated("Authentication required");
      }

      const orgId = Number((authData as any).orgId);
      const userId = Number((authData as any).userID);
      const userName =
        (authData as any).displayName ||
        (authData as any).email ||
        `User ${userId}`;

      if (!handshake.services || handshake.services.length === 0) {
        throw APIError.invalidArgument("At least one service must be specified");
      }

      if (handshake.version !== 1) {
        throw APIError.invalidArgument(`Unsupported protocol version: ${handshake.version}`);
      }

      console.log("[UnifiedStream][connected]", {
        orgId,
        userId,
        services: handshake.services,
        lastSeq: handshake.lastSeq,
      });

      metrics.activeConnections++;
      metrics.totalConnections++;

      let closed = false;
      let pingInterval: any = null;
      let resolveClose: (() => void) | null = null;
      const closePromise = new Promise<void>((resolve) => {
        resolveClose = resolve;
      });

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        connectionPool.unregister(orgId, connection);
        metrics.activeConnections--;
      };

      const failStream = (source: string, err: unknown) => {
        console.error("[UnifiedStream][stream-error]", {
          orgId,
          userId,
          source,
          error: err instanceof Error ? err.message : String(err),
        });
        cleanup();
        if (resolveClose) {
          resolveClose();
        }
      };

      const sendToClient = async (message: StreamOutMessage): Promise<void> => {
        if (closed) return;
        try {
          await stream.send(message);
          connectionPool.updateActivity(connection);
        } catch (err) {
          failStream("send", err);
          throw err;
        }
      };

      const connection = connectionPool.register(
        orgId,
        userId,
        userName,
        new Set(handshake.services),
        handshake.propertyId ?? null,
        sendToClient
      );

      // Replay missed events if lastSeq provided
      if (handshake.lastSeq && handshake.lastSeq > 0) {
        for (const service of handshake.services) {
          const missed = getMissedEvents(orgId, service, handshake.lastSeq);

          if (missed.length > 0) {
            for (const recentEvent of missed) {
              const message: StreamOutMessage = {
                type: "event",
                service,
                events: [recentEvent.event],
                timestamp: new Date(recentEvent.timestamp).toISOString(),
                seq: recentEvent.seq,
              };

              await sendToClient(message);
              metrics.missedEventsReplayed++;
            }
          }
        }
      }

      // Send ack
      await stream.send({
        type: "ack",
        seq: 0,
        timestamp: new Date().toISOString(),
      });

      // Keep-alive pings
      pingInterval = setInterval(async () => {
        if (closed) return;
        try {
          await stream.send({
            type: "ping",
            timestamp: new Date().toISOString(),
            seq: 0,
          });
        } catch (err) {
          failStream("ping", err);
        }
      }, CONFIG.PING_INTERVAL_MS);

      // Wait until the stream fails or is closed (failStream will resolve closePromise)
      await closePromise;
    } catch (err) {
      console.error("[UnifiedStream][handler-error]", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        handshake,
      });
      if (err instanceof APIError) {
        throw err;
      }
      throw APIError.internal("streamRealtimeEvents failed", err as Error);
    }
  }
);

/**
 * Connection pool stats interface
 */
interface ConnectionPoolStats {
  totalConnections: number;
  totalOrgs: number;
  connectionsByOrg: Array<{ orgId: number; connections: number }>;
}

/**
 * Get streaming metrics
 */
export const getStreamingMetrics = api(
  {
    auth: true,
    expose: true,
    method: "GET",
    path: "/v2/realtime/metrics",
  },
  async (): Promise<{
    activeConnections: number;
    totalConnections: number;
    eventsDelivered: number;
    eventsByService: Record<string, number>;
    errorCount: number;
    missedEventsReplayed: number;
    connectionPoolStats: ConnectionPoolStats;
  }> => {
    return {
      activeConnections: metrics.activeConnections,
      totalConnections: metrics.totalConnections,
      eventsDelivered: metrics.eventsDelivered,
      eventsByService: metrics.eventsByService,
      errorCount: metrics.errorCount,
      missedEventsReplayed: metrics.missedEventsReplayed,
      connectionPoolStats: connectionPool.getStats(),
    };
  }
);
