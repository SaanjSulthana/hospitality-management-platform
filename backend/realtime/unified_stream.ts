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
import { gzipSync } from "zlib";
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
  // Defaults ON unless explicitly disabled
  CONFLATION_ENABLED: (typeof process !== "undefined" && process.env && process.env.REALTIME_CONFLATION === "false") ? false : true,
  COMPRESS_BATCHES: (typeof process !== "undefined" && process.env && process.env.REALTIME_COMPRESS_BATCHES === "false") ? false : true,
  // Server-side conflation rollout percent (0–100)
  CONFLATION_ROLLOUT_PERCENT: (() => {
    const v = (typeof process !== "undefined" && process.env && process.env.REALTIME_CONFLATION_ROLLOUT_PERCENT) || "100";
    const n = Math.max(0, Math.min(100, parseInt(String(v), 10) || 100));
    return n;
  })(),
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
  conflationInput: 0,
  conflationOutput: 0,
  bytesBefore: 0,
  bytesAfter: 0,
  compressedBatchesServed: 0,
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
 * FIX: Track last access time for cleanup
 */
interface SeqEntry {
  seq: number;
  lastAccess: number;
}
const orgServiceSeq = new Map<string, SeqEntry>();

/**
 * Cleanup configuration
 */
const CLEANUP_CONFIG = {
  /** How long before an idle org-service sequence entry is cleaned up (30 min) */
  SEQ_IDLE_MS: 30 * 60 * 1000,
  /** How long before an idle batch window entry is cleaned up (30 min) */
  BATCH_WINDOW_IDLE_MS: 30 * 60 * 1000,
};

/**
 * Track batch window last access for cleanup
 */
const batchWindowLastAccess = new Map<string, number>();

/**
 * Periodic cleanup for event buffer, sequence counters, and batch windows
 * Runs every minute to remove expired/idle entries
 */
setInterval(() => {
  const now = Date.now();
  const cutoff = now - CONFIG.MISSED_EVENTS_WINDOW_MS;
  const seqIdleCutoff = now - CLEANUP_CONFIG.SEQ_IDLE_MS;
  const batchWindowIdleCutoff = now - CLEANUP_CONFIG.BATCH_WINDOW_IDLE_MS;

  let buffersRemoved = 0;
  let buffersKept = 0;
  let seqEntriesRemoved = 0;
  let batchWindowsRemoved = 0;

  // Clean up event buffers
  for (const [key, buffer] of recentEventsBuffer.entries()) {
    const filtered = buffer.filter(e => e.timestamp > cutoff);

    if (filtered.length === 0) {
      recentEventsBuffer.delete(key);
      buffersRemoved++;
    } else {
      if (filtered.length < buffer.length) {
        recentEventsBuffer.set(key, filtered);
      }
      buffersKept++;
    }
  }

  // FIX: Clean up idle org-service sequence entries (memory leak)
  for (const [key, entry] of orgServiceSeq.entries()) {
    if (entry.lastAccess < seqIdleCutoff) {
      orgServiceSeq.delete(key);
      seqEntriesRemoved++;
    }
  }

  // FIX: Clean up idle batch window entries (memory leak)
  for (const [key, lastAccess] of batchWindowLastAccess.entries()) {
    if (lastAccess < batchWindowIdleCutoff) {
      batchWindowMsMap.delete(key);
      batchWindowLastAccess.delete(key);
      batchWindowsRemoved++;
    }
  }

  // Only log when there's meaningful activity (reduce log spam)
  if (buffersRemoved > 0 || seqEntriesRemoved > 0 || batchWindowsRemoved > 0 || buffersKept > 10) {
    console.log("[UnifiedStream][cleanup]", {
      buffersKept,
      buffersRemoved,
      seqEntriesRemoved,
      batchWindowsRemoved,
      seqEntriesActive: orgServiceSeq.size,
      batchWindowsActive: batchWindowMsMap.size,
    });
  }
}, 60_000); // Every minute

/**
 * Get next sequence number for org+service
 * FIX: Now tracks lastAccess for cleanup
 */
function getNextSeq(orgId: number, service: ServiceName): number {
  const key = `${orgId}-${service}`;
  const entry = orgServiceSeq.get(key);
  const current = entry?.seq || 0;
  const next = current + 1;
  orgServiceSeq.set(key, { seq: next, lastAccess: Date.now() });
  return next;
}

/**
 * Deterministic org bucketing for rollout percentages
 */
function isInConflationRollout(orgId: number): boolean {
  if (!CONFIG.CONFLATION_ENABLED) return false;
  const percent = CONFIG.CONFLATION_ROLLOUT_PERCENT;
  if (percent >= 100) return true;
  const bucket = (orgId * 1103515245 + 12345) >>> 0; // LCG
  const normalized = (bucket % 10000) / 100; // 0..100
  return normalized < percent;
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
const batchWindowMsMap = new Map<string, number>(); // key: orgId-service → current window

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

  // Entity-aware conflation (last-write-wins within window)
  let eventsToSend = batch.events;
  if (isInConflationRollout(orgId)) {
    const byEntity = new Map<string, any>();
    for (const ev of batch.events) {
      const eid = String((ev as any)?.entityId ?? '');
      const etype = String((ev as any)?.entityType ?? '');
      const key = `${etype}:${eid}`;
      // Merge by shallow spread (later event wins)
      const existing = byEntity.get(key);
      if (existing) {
        byEntity.set(key, { ...existing, ...ev });
      } else {
        byEntity.set(key, ev);
      }
    }
    const inputCount = batch.events.length;
    eventsToSend = Array.from(byEntity.values());
    const outputCount = eventsToSend.length;
    metrics.conflationInput += inputCount;
    metrics.conflationOutput += outputCount;
    // Approximate bytes saved
    try {
      const before = JSON.stringify(batch.events).length;
      const after = JSON.stringify(eventsToSend).length;
      metrics.bytesBefore += before;
      metrics.bytesAfter += after;
    } catch { }
  }

  // Create batch message
  const outMessage: StreamOutMessage = {
    type: "batch",
    service: service as ServiceName,
    events: eventsToSend,
    timestamp: new Date().toISOString(),
    seq,
    messages: eventsToSend.map((event, idx) => ({
      service: service as ServiceName,
      events: [event],
      timestamp: new Date().toISOString(),
      seq: seq + idx,
      type: "event" as const,
    })),
  };

  // Optional compression (non-breaking: keep messages/events as well)
  if (CONFIG.COMPRESS_BATCHES) {
    try {
      const json = JSON.stringify(outMessage.messages);
      if (json.length > CONFIG.COMPRESSION_THRESHOLD) {
        const gz = gzipSync(Buffer.from(json));
        (outMessage as any).compressed = true;
        (outMessage as any).data = Buffer.from(gz).toString("base64");
        metrics.compressedBatchesServed++;
      }
    } catch (err) {
      console.warn("[UnifiedStream][compression-failed]", { error: (err as any)?.message });
    }
  }

  // Broadcast batch
  await connectionPool.broadcast(orgId, service as ServiceName, outMessage as any);

  metrics.eventsDelivered += eventsToSend.length;
  metrics.batchesSent++;
  metrics.eventsByService[service as ServiceName] =
    (metrics.eventsByService[service as ServiceName] || 0) + eventsToSend.length;

  // Adaptive batch window tuning
  const prev = batchWindowMsMap.get(key) ?? CONFIG.BATCH_WINDOW_MS;
  let next = prev;
  const n = batch.events.length;
  if (n >= Math.floor(CONFIG.MAX_BATCH_SIZE * 0.8)) {
    // Widen window under high load to reduce message count
    next = Math.min(150, prev + 25);
  } else if (n <= 3) {
    // Narrow window when idle for lower latency
    next = Math.max(30, prev - 10);
  }
  batchWindowMsMap.set(key, next);
  // FIX: Track last access for cleanup
  batchWindowLastAccess.set(key, Date.now());
  // Track by service (last tuned value)
  (metrics as any).currentBatchWindowMsByService = (metrics as any).currentBatchWindowMsByService || {};
  (metrics as any).currentBatchWindowMsByService[service as ServiceName] = next;
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
        timer: setTimeout(() => flushBatch(key), batchWindowMsMap.get(key) ?? CONFIG.BATCH_WINDOW_MS),
      });
    }

    const batch = eventBatcher.get(key)!;
    batch.events.push(event);

    // Flush if batch full
    if (batch.events.length >= CONFIG.MAX_BATCH_SIZE) {
      clearTimeout(batch.timer);
      await flushBatch(key);
    } else {
      // Reschedule with current adaptive window (reset timer on activity bursts)
      clearTimeout(batch.timer);
      batch.timer = setTimeout(() => flushBatch(key), batchWindowMsMap.get(key) ?? CONFIG.BATCH_WINDOW_MS);
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
 * Emit an invalidation message to all connections for an org+service.
 * Useful for low-tier aggregates (e.g., analytics) where clients should refetch.
 */
export async function emitInvalidation(
  orgId: number,
  service: ServiceName,
  keys: string[]
): Promise<void> {
  if (!Array.isArray(keys) || keys.length === 0) return;
  const seq = getNextSeq(orgId, service);
  const message: StreamOutMessage = {
    type: "invalidate",
    service,
    timestamp: new Date().toISOString(),
    seq,
    // Attach also as StreamMessage-compatible invalidate field for connection_pool typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invalidate: { keys } as any,
  };
  await connectionPool.broadcast(orgId, service, message as any);
}

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
  // Extended metrics exposed by connectionPool.getStats()
  sentTotal?: number;
  droppedTotal?: number;
  quarantinedActive?: number;
  totalSubscriptions?: number;
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
    conflation: {
      input: number;
      output: number;
      ratio: number;
      bytesBefore: number;
      bytesAfter: number;
      bytesSaved: number;
      currentBatchWindowMsByService?: Record<string, number>;
    };
    compression: {
      compressedBatchesServed: number;
      batchesSent: number;
      hitRate: number;
    };
  }> => {
    return {
      activeConnections: metrics.activeConnections,
      totalConnections: metrics.totalConnections,
      eventsDelivered: metrics.eventsDelivered,
      eventsByService: metrics.eventsByService,
      errorCount: metrics.errorCount,
      missedEventsReplayed: metrics.missedEventsReplayed,
      connectionPoolStats: connectionPool.getStats(),
      conflation: {
        input: metrics.conflationInput,
        output: metrics.conflationOutput,
        ratio: metrics.conflationInput > 0 ? metrics.conflationOutput / metrics.conflationInput : 1,
        bytesBefore: metrics.bytesBefore,
        bytesAfter: metrics.bytesAfter,
        bytesSaved: Math.max(0, metrics.bytesBefore - metrics.bytesAfter),
        currentBatchWindowMsByService: (metrics as any).currentBatchWindowMsByService,
      },
      compression: {
        compressedBatchesServed: metrics.compressedBatchesServed,
        batchesSent: metrics.batchesSent,
        hitRate: metrics.batchesSent > 0 ? metrics.compressedBatchesServed / metrics.batchesSent : 0,
      },
    };
  }
);

/**
 * Update services/property filter for the caller's active WS connections (dynamic subscription update)
 */
export const updateStreamSubscriptions = api(
  {
    auth: true,
    expose: true,
    method: "POST",
    path: "/v2/realtime/update-services",
  },
  async (req: { services: ServiceName[]; propertyId?: number | null }): Promise<{ updated: number }> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    const orgId = Number((authData as any).orgId);
    const userId = Number((authData as any).userID);
    const services = new Set<ServiceName>((req?.services || []) as ServiceName[]);
    if (services.size === 0) {
      throw APIError.invalidArgument("At least one service must be specified");
    }
    const propertyId = typeof req?.propertyId === "number" ? req.propertyId : req?.propertyId ?? null;
    const updated = connectionPool.updateUserConnections(orgId, userId, services, propertyId);
    return { updated };
  }
);

/**
 * Update delivery credits for the caller's active connections (optional flow control)
 */
export const updateStreamCredits = api(
  {
    auth: true,
    expose: true,
    method: "POST",
    path: "/v2/realtime/credits",
  },
  async (req: { credits: number }): Promise<{ updated: number }> => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    const orgId = Number((authData as any).orgId);
    const userId = Number((authData as any).userID);
    const credits = typeof req?.credits === "number" ? Math.max(0, Math.floor(req.credits)) : 0;
    const updated = connectionPool.setCredits(orgId, userId, credits);
    return { updated };
  }
);
