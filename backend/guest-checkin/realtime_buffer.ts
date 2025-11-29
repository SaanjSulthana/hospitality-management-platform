/**
 * Guest Check-In Realtime Buffer
 * 
 * Production-grade in-memory event buffer with:
 * - Waiter pattern for instant notification (no polling loops)
 * - PropertyId filtering for multi-property orgs
 * - TTL-based event expiration (25 seconds)
 * - Org idle eviction (2 minutes)
 * - Waiter cap protection (max 5000 per org)
 * - Comprehensive metrics
 */

import type { GuestEventPayload } from './guest-checkin-events';

// Configuration constants
const MAX_BUFFER_SIZE = 200;        // Max events per org
const EVENT_TTL_MS = 25_000;        // 25 seconds
const LONG_POLL_TIMEOUT_MS = 25_000;
const MAX_WAITERS_PER_ORG = 5000;   // Prevent waiter explosion
const ORG_IDLE_EVICT_MS = 120_000;  // 2 minutes

interface BufferEntry {
  event: GuestEventPayload;
  insertedAt: number;
}

interface OrgBuffer {
  events: BufferEntry[];
  waiters: Array<{
    resolve: (events: GuestEventPayload[]) => void;
    propertyId?: number;
    createdAt: number;
  }>;
  lastActivity: number;
}

// Singleton in-memory store
const orgBuffers = new Map<number, OrgBuffer>();

// Metrics
let metricsPublished = 0;
let metricsDelivered = 0;
let metricsDropped = 0;

/**
 * Push event to org buffer; wake matching waiters instantly
 * @param orgId - Organization ID
 * @param propertyId - Optional property filter
 * @param event - Guest check-in event
 */
export function pushEvent(orgId: number, propertyId: number | undefined, event: GuestEventPayload): void {
  let buffer = orgBuffers.get(orgId);
  if (!buffer) {
    buffer = { events: [], waiters: [], lastActivity: Date.now() };
    orgBuffers.set(orgId, buffer);
  }
  
  buffer.lastActivity = Date.now();
  
  // Add event with TTL
  buffer.events.push({ event, insertedAt: Date.now() });
  metricsPublished++;
  
  // Enforce size limit (drop oldest)
  while (buffer.events.length > MAX_BUFFER_SIZE) {
    buffer.events.shift();
    metricsDropped++;
  }
  
  // Wake waiters matching propertyId (or all if no filter)
  const now = Date.now();
  const wakers: Array<() => void> = [];
  
  buffer.waiters = buffer.waiters.filter(waiter => {
    // If waiter has propertyId filter and it doesn't match, keep waiting
    if (waiter.propertyId !== undefined && waiter.propertyId !== propertyId) {
      return true; // Keep waiting
    }
    
    // Deliver events to this waiter
    const events = filterEvents(buffer.events, waiter.propertyId).map(e => e.event);
    wakers.push(() => {
      waiter.resolve(events);
      metricsDelivered += events.length;
    });
    
    return false; // Remove from waiters
  });
  
  // Execute outside the filter loop
  wakers.forEach(fn => fn());
}

/**
 * Long-poll subscribe: drain existing events or wait for new ones
 * @param orgId - Organization ID
 * @param propertyId - Optional property filter
 * @param timeoutMs - Max wait time in milliseconds
 * @returns Array of guest check-in events
 */
export async function subscribe(
  orgId: number,
  propertyId?: number,
  timeoutMs = LONG_POLL_TIMEOUT_MS
): Promise<GuestEventPayload[]> {
  let buffer = orgBuffers.get(orgId);
  if (!buffer) {
    buffer = { events: [], waiters: [], lastActivity: Date.now() };
    orgBuffers.set(orgId, buffer);
  }
  
  buffer.lastActivity = Date.now();
  
  // Evict expired events
  const now = Date.now();
  buffer.events = buffer.events.filter(e => now - e.insertedAt < EVENT_TTL_MS);
  
  // If events exist, return immediately
  const existing = filterEvents(buffer.events, propertyId);
  if (existing.length > 0) {
    const events = existing.map(e => e.event);
    // Clear delivered events
    buffer.events = buffer.events.filter(e => !events.includes(e.event));
    metricsDelivered += events.length;
    return events;
  }
  
  // Enforce waiter cap
  if (buffer.waiters.length >= MAX_WAITERS_PER_ORG) {
    console.warn(`[GuestRealtimeBuffer] Waiter cap reached for org ${orgId}`);
    return []; // Graceful degradation
  }
  
  // Wait for events
  return new Promise<GuestEventPayload[]>((resolve) => {
    const waiter = { resolve, propertyId, createdAt: now };
    buffer!.waiters.push(waiter);
    
    // Timeout
    const timer = setTimeout(() => {
      const idx = buffer!.waiters.indexOf(waiter);
      if (idx >= 0) {
        buffer!.waiters.splice(idx, 1);
        resolve([]);
      }
    }, timeoutMs);
    
    // Ensure cleanup
    const originalResolve = waiter.resolve;
    waiter.resolve = (events) => {
      clearTimeout(timer);
      originalResolve(events);
    };
  });
}

/**
 * Filter events by propertyId (if provided)
 */
function filterEvents(entries: BufferEntry[], propertyId?: number): BufferEntry[] {
  if (propertyId === undefined) return entries;
  return entries.filter(e => e.event.propertyId === propertyId);
}

/**
 * Periodic cleanup: evict idle orgs
 */
setInterval(() => {
  const now = Date.now();
  for (const [orgId, buffer] of orgBuffers.entries()) {
    if (now - buffer.lastActivity > ORG_IDLE_EVICT_MS && buffer.waiters.length === 0) {
      orgBuffers.delete(orgId);
    }
  }
}, 60_000); // Every minute

/**
 * Metrics for observability
 */
export function getRealtimeBufferMetrics() {
  let totalSize = 0;
  let activeOrgs = 0;
  let totalWaiters = 0;
  
  for (const buffer of orgBuffers.values()) {
    totalSize += buffer.events.length;
    totalWaiters += buffer.waiters.length;
    if (buffer.waiters.length > 0 || buffer.events.length > 0) {
      activeOrgs++;
    }
  }
  
  return {
    orgs: {
      total: orgBuffers.size,
      active_last_5m: activeOrgs,
    },
    events: {
      published_total: metricsPublished,
      delivered_total: metricsDelivered,
      dropped_total: metricsDropped,
    },
    buffers: {
      total_size: totalSize,
      avg_per_org: orgBuffers.size > 0 ? totalSize / orgBuffers.size : 0,
    },
    subscribers: {
      active_count: totalWaiters,
    },
  };
}

