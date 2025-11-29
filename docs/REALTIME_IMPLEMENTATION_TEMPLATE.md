# Realtime Implementation Playbook: <DOMAIN> Service

> **Template Version:** 2.0  
> **Last Updated:** November 2024  
> **Reference:** [NETWORKING_AND_REALTIME_IMPROVEMENTS.md](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)

---

## 🎯 Overview

This template provides a complete, production-ready guide for implementing the Finance-page realtime/networking playbook across any service/page in the hospitality management platform.

**Target Scale:** 1M organizations × 5 properties × 5 users  
**Performance Goal:** Instant UI updates, minimal backend load, graceful degradation  
**Architecture:** Long-poll + in-memory buffer + leader/follower client pattern

---

## 📋 Prerequisites (Complete Before Implementation)

### Step 1: Domain Analysis
- [ ] **Service/Domain Name:** `_____________` (e.g., Tasks, Staff, Users, Analytics)
- [ ] **Page Name:** `_____________` (e.g., TasksPage, StaffPage)
- [ ] **Primary Entity:** `_____________` (e.g., Task, StaffMember, User)
- [ ] **Entity ID Field:** `_____________` (e.g., taskId, staffId, userId)

### Step 2: Event Mapping
- [ ] **Identify existing Pub/Sub topics:**
  ```typescript
  // Example: backend/tasks/events.ts
  export const TaskCreatedTopic = new Topic<TaskCreatedEvent>("task-created");
  export const TaskUpdatedTopic = new Topic<TaskUpdatedEvent>("task-updated");
  export const TaskDeletedTopic = new Topic<TaskDeletedEvent>("task-deleted");
  ```
- [ ] **List event publishers:** (Where are these events currently published?)
  - `_______________` (e.g., backend/tasks/create_task.ts)
  - `_______________`
  - `_______________`

- [ ] **Verify orgId/propertyId in event payloads:**
  ```typescript
  // Events MUST include these fields:
  interface DomainEvent {
    eventId: string;      // UUID for deduplication
    eventType: string;    // e.g., "TaskCreated"
    timestamp: number;    // Unix timestamp
    orgId: string;        // Required
    propertyId?: string;  // If domain is property-scoped
    payload: any;         // Domain-specific data
  }
  ```

### Step 3: Conflict Check
- [ ] **No existing realtime implementation:** Search for:
  - `use<Domain>Realtime*.ts` hooks
  - `/<domain>/realtime/subscribe` endpoints
  - Legacy polling hooks (e.g., `use<Domain>Events` with intervals)
  
- [ ] **React Query keys documented:** List existing query keys:
  - `_______________` (e.g., ['tasks', 'list'])
  - `_______________` (e.g., ['tasks', taskId])
  - `_______________` (e.g., ['tasks', 'summary'])

### Step 4: Infrastructure Check
- [ ] **Encore backend deployed and accessible**
- [ ] **CORS configured:** Verify `backend/encore.app` has:
  ```json
  "global_cors": {
    "allowed_origins_without_credentials": ["http://localhost:5173"],
    "allowed_origins_with_credentials": ["https://yourdomain.com"],
    "allow_headers": ["Content-Type", "Authorization", "X-Request-ID"],
    "expose_headers": ["Content-Type", "X-Request-ID"],
    "max_age_seconds": 7200
  }
  ```
- [ ] **Telemetry endpoint exists:** `POST /telemetry/client`
- [ ] **Auth patterns in place:** `AuthContext`, `GlobalAuthBanner`, `Layout`

### Step 5: Read Reference Materials
- [ ] **Read:** [NETWORKING_AND_REALTIME_IMPROVEMENTS.md](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)
- [ ] **Review Finance implementation:**
  - Backend: `backend/finance/realtime_*.ts` files
  - Frontend: `frontend/hooks/useFinanceRealtimeV2.ts`
  - Integration: `frontend/pages/FinancePage.tsx`

---

## 🏗️ Phase 1: Backend Implementation (2-4 hours)

### 1.1: Event Types & Schema

**File:** `backend/<domain>/events.ts` (or create if missing)

```typescript
// Define your domain event types
export interface <Domain>Event {
  eventId: string;
  eventType: '<Domain>Created' | '<Domain>Updated' | '<Domain>Deleted' | '<Domain>StatusChanged';
  timestamp: number;
  orgId: string;
  propertyId?: string;  // If applicable
  payload: {
    <entityId>: string;
    // Other domain-specific fields
    [key: string]: any;
  };
}

// Pub/Sub Topics (may already exist)
export const <Domain>EventsTopic = new Topic<<Domain>Event>("<domain>-events");
```

### 1.2: In-Memory Buffer

**File:** `backend/<domain>/realtime_buffer.ts`

```typescript
import type { <Domain>Event } from './events';

// Configuration constants
const MAX_BUFFER_SIZE = 200;        // Max events per org
const EVENT_TTL_MS = 25_000;        // 25 seconds
const LONG_POLL_TIMEOUT_MS = 25_000;
const MAX_WAITERS_PER_ORG = 5000;   // Prevent waiter explosion
const ORG_IDLE_EVICT_MS = 120_000;  // 2 minutes

interface BufferEntry {
  event: <Domain>Event;
  insertedAt: number;
}

interface OrgBuffer {
  events: BufferEntry[];
  waiters: Array<{
    resolve: (events: <Domain>Event[]) => void;
    propertyId?: string;
    createdAt: number;
  }>;
  lastActivity: number;
}

// Singleton in-memory store
const orgBuffers = new Map<string, OrgBuffer>();

// Metrics
let metricsPublished = 0;
let metricsDelivered = 0;
let metricsDropped = 0;

/**
 * Push event to org buffer; wake waiters
 */
export function pushEvent(orgId: string, propertyId: string | undefined, event: <Domain>Event): void {
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
    if (waiter.propertyId && waiter.propertyId !== propertyId) {
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
 * Long-poll subscribe: drain existing events or wait
 */
export async function subscribe(
  orgId: string,
  propertyId?: string,
  timeoutMs = LONG_POLL_TIMEOUT_MS
): Promise<<Domain>Event[]> {
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
    console.warn(`[RealtimeBuffer] Waiter cap reached for org ${orgId}`);
    return []; // Graceful degradation
  }
  
  // Wait for events
  return new Promise<Domain>Event[]>((resolve) => {
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
function filterEvents(entries: BufferEntry[], propertyId?: string): BufferEntry[] {
  if (!propertyId) return entries;
  return entries.filter(e => !e.event.propertyId || e.event.propertyId === propertyId);
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
```

### 1.3: Realtime Subscriber

**File:** `backend/<domain>/realtime_subscriber.ts`

```typescript
import { Subscription } from "encore.dev/pubsub";
import { <Domain>EventsTopic, type <Domain>Event } from './events';
import { pushEvent } from './realtime_buffer';

// Subscribe to domain events and push to buffer
export const realtimeSubscriber = new Subscription(
  <Domain>EventsTopic,
  "<domain>-realtime-subscriber",
  {
    handler: async (event: <Domain>Event) => {
      try {
        // Extract orgId and propertyId from event
        const { orgId, propertyId } = event;
        
        if (!orgId) {
          console.error(`[RealtimeSubscriber] Event missing orgId:`, event.eventId);
          return;
        }
        
        // Push to buffer (wakes waiters)
        pushEvent(orgId, propertyId, event);
        
      } catch (error) {
        console.error(`[RealtimeSubscriber] Failed to process event:`, error);
      }
    },
    ackDeadline: 30,
    messageRetention: 24 * 60 * 60, // 24 hours
    maxConcurrency: 100,
  }
);
```

### 1.4: Subscribe Endpoint

**File:** `backend/<domain>/subscribe_realtime.ts`

```typescript
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/auth";
import { subscribe } from './realtime_buffer';
import type { <Domain>Event } from './events';

interface SubscribeRequest {
  propertyId?: string;
}

interface SubscribeResponse {
  events: <Domain>Event[];
}

/**
 * Long-poll subscribe endpoint
 * Returns immediately if events exist; otherwise waits up to 25s
 */
export const subscribeRealtime = api(
  { expose: true, method: "GET", path: "/<domain>/realtime/subscribe", auth: true },
  async (req: SubscribeRequest): Promise<SubscribeResponse> => {
    const startTime = Date.now();
    const auth = getAuthData();
    const orgId = auth!.userID; // Adjust based on your auth structure
    const { propertyId } = req;
    
    // Extract request context for logging
    const origin = req.headers?.origin || 'unknown';
    const ua = req.headers?.['user-agent'] || 'unknown';
    const uaTruncated = ua.substring(0, 50);
    
    try {
      // Subscribe (drains or waits)
      const events = await subscribe(orgId, propertyId);
      
      const durationMs = Date.now() - startTime;
      
      // Context-only completion log
      console.log(
        `[RealtimeSubscribe][completed] orgId=${orgId} userId=${auth!.userID} ` +
        `propertyId=${propertyId || 'all'} events=${events.length} durationMs=${durationMs} ` +
        `origin=${origin} ua="${uaTruncated}"`
      );
      
      return { events };
      
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      console.error(
        `[RealtimeSubscribe][failure] orgId=${orgId} userId=${auth!.userID} ` +
        `propertyId=${propertyId || 'all'} durationMs=${durationMs} ` +
        `origin=${origin} ua="${uaTruncated}" error=${error}`
      );
      
      throw APIError.internal("Failed to subscribe to realtime events");
    }
  }
);
```

### 1.5: Metrics Endpoint

**File:** `backend/<domain>/realtime_metrics.ts`

```typescript
import { api } from "encore.dev/api";
import { getRealtimeBufferMetrics } from './realtime_buffer';

/**
 * Expose buffer metrics for monitoring/dashboards
 */
export const getMetrics = api(
  { expose: true, method: "GET", path: "/<domain>/realtime/metrics", auth: true },
  async () => {
    return getRealtimeBufferMetrics();
  }
);
```

### 1.6: Legacy Cleanup (If Applicable)

**If a legacy polling endpoint exists:**

```typescript
// backend/<domain>/subscribe_events.ts (or similar)
import { api, APIError } from "encore.dev/api";

export const legacySubscribe = api(
  { expose: true, method: "GET", path: "/<domain>/events/subscribe", auth: true },
  async () => {
    // Return 410 Gone in production
    if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_LEGACY_<DOMAIN>_EVENTS) {
      throw APIError.unavailable("This endpoint has been deprecated. Use /<domain>/realtime/subscribe");
    }
    
    // Dev fallback (optional)
    return { events: [] };
  }
);
```

---

## 🎨 Phase 2: Frontend Client (3-5 hours)

### 2.1: Realtime Hook

**File:** `frontend/hooks/use<Domain>RealtimeV2.ts`

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { <Domain>Event } from '@/types/<domain>';

// Constants
const LONG_POLL_TIMEOUT = 25_000;
const FAST_EMPTY_THRESHOLD_MS = 1500;
const FAST_EMPTY_BACKOFF_MS = [2000, 5000];
const HIDDEN_BACKOFF_MS = [3000, 5000];
const FOLLOWER_BACKOFF_MS = [3000, 5000];
const LEADER_LEASE_MS = 10_000;
const TELEMETRY_SAMPLE_RATE = 0.02; // 2%

interface RealtimeOptions {
  propertyId?: string;
  enabled?: boolean;
  onEvents?: (events: <Domain>Event[]) => void;
}

/**
 * Leader/Follower realtime hook with RTT-aware backoff
 */
export function use<Domain>RealtimeV2(options: RealtimeOptions = {}) {
  const { propertyId, enabled = true, onEvents } = options;
  const { token } = useAuth();
  
  const [isLeader, setIsLeader] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const leaderLeaseRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const resubscribeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('<domain>-events');
    channelRef.current = channel;
    
    // Followers listen for events from leader
    channel.onmessage = (e) => {
      if (e.data.type === 'events' && !isLeader && onEvents) {
        onEvents(e.data.events);
      }
    };
    
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [isLeader, onEvents]);
  
  // Leader election
  const acquireLease = useCallback(async (): Promise<boolean> => {
    try {
      // Try Web Locks API (preferred)
      if ('locks' in navigator) {
        const acquired = await navigator.locks.request(
          '<domain>-realtime-leader',
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (lock) {
              leaderLeaseRef.current = Date.now();
              return true;
            }
            return false;
          }
        );
        return acquired || false;
      }
      
      // Fallback: localStorage lease
      const leaseKey = '<domain>-leader-lease';
      const now = Date.now();
      const existing = localStorage.getItem(leaseKey);
      
      if (existing) {
        const lease = JSON.parse(existing);
        if (now - lease.timestamp < LEADER_LEASE_MS) {
          return false; // Another leader holds lease
        }
      }
      
      // Acquire lease
      localStorage.setItem(leaseKey, JSON.stringify({ timestamp: now }));
      leaderLeaseRef.current = now;
      
      // Emit telemetry
      if (Math.random() < TELEMETRY_SAMPLE_RATE) {
        sendTelemetry('leader_acquired', { method: 'localStorage' });
      }
      
      return true;
      
    } catch (error) {
      console.error('[<Domain>RealtimeV2] Failed to acquire lease:', error);
      return false;
    }
  }, []);
  
  // Renew lease periodically
  useEffect(() => {
    if (!isLeader) return;
    
    const interval = setInterval(() => {
      if (leaderLeaseRef.current) {
        const now = Date.now();
        if (now - leaderLeaseRef.current < LEADER_LEASE_MS) {
          localStorage.setItem(
            '<domain>-leader-lease',
            JSON.stringify({ timestamp: now })
          );
          leaderLeaseRef.current = now;
        }
      }
    }, LEADER_LEASE_MS / 2);
    
    return () => clearInterval(interval);
  }, [isLeader]);
  
  // Long-poll logic
  const longPoll = useCallback(async () => {
    if (!enabled || !token) {
      setIsConnected(false);
      return;
    }
    
    // Only leader should long-poll
    const acquired = await acquireLease();
    if (acquired && !isLeader) {
      setIsLeader(true);
      if (Math.random() < TELEMETRY_SAMPLE_RATE) {
        sendTelemetry('leader_takeover', {});
      }
    }
    
    if (!acquired) {
      setIsLeader(false);
      // Followers check less frequently
      const backoff = randomInRange(FOLLOWER_BACKOFF_MS);
      if (resubscribeTimerRef.current) clearTimeout(resubscribeTimerRef.current);
      resubscribeTimerRef.current = setTimeout(longPoll, backoff);
      return;
    }
    
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const startTime = Date.now();
    
    try {
      const url = new URL('/<domain>/realtime/subscribe', import.meta.env.VITE_API_URL);
      if (propertyId) {
        url.searchParams.set('propertyId', propertyId);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });
      
      const elapsedMs = Date.now() - startTime;
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Auth issue; pause and let AuthContext handle
          setIsConnected(false);
          return;
        }
        throw new Error(`Subscribe failed: ${response.status}`);
      }
      
      const data = await response.json();
      const events = data.events || [];
      
      setIsConnected(true);
      
      if (events.length > 0) {
        setLastEventTime(Date.now());
        
        // Broadcast to followers
        if (channelRef.current) {
          channelRef.current.postMessage({ type: 'events', events });
        }
        
        // Notify callback
        if (onEvents) {
          onEvents(events);
        }
      }
      
      // RTT-aware backoff
      let backoff = 0;
      const isHidden = document.visibilityState === 'hidden';
      
      if (elapsedMs < FAST_EMPTY_THRESHOLD_MS && events.length === 0) {
        // Fast-empty: backend had no events; slow down
        backoff = randomInRange(FAST_EMPTY_BACKOFF_MS);
        
        if (Math.random() < TELEMETRY_SAMPLE_RATE) {
          sendTelemetry('fast_empty', { elapsedMs, backoffMs: backoff, isLeader: true });
        }
      } else if (isHidden) {
        // Hidden tab: slow cadence
        backoff = randomInRange(HIDDEN_BACKOFF_MS);
      }
      
      // Resubscribe
      if (resubscribeTimerRef.current) clearTimeout(resubscribeTimerRef.current);
      resubscribeTimerRef.current = setTimeout(longPoll, backoff);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Expected on tab close
        return;
      }
      
      console.error('[<Domain>RealtimeV2] Long-poll error:', error);
      setIsConnected(false);
      
      // Exponential backoff on errors
      const backoff = Math.min(2000 * Math.pow(2, Math.random()), 60000);
      if (resubscribeTimerRef.current) clearTimeout(resubscribeTimerRef.current);
      resubscribeTimerRef.current = setTimeout(longPoll, backoff);
    }
  }, [enabled, token, propertyId, isLeader, onEvents, acquireLease]);
  
  // Start long-poll when conditions met
  useEffect(() => {
    if (enabled && token) {
      longPoll();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (resubscribeTimerRef.current) {
        clearTimeout(resubscribeTimerRef.current);
        resubscribeTimerRef.current = null;
      }
    };
    // Note: isLeader is intentionally NOT in deps to prevent restart storms
  }, [enabled, token, propertyId]);
  
  // Listen to auth-control for logout
  useEffect(() => {
    const authChannel = new BroadcastChannel('auth-control');
    
    authChannel.onmessage = (e) => {
      if (e.data.type === 'logout') {
        // Stop immediately
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (resubscribeTimerRef.current) {
          clearTimeout(resubscribeTimerRef.current);
        }
        setIsConnected(false);
        setIsLeader(false);
      }
    };
    
    // Fallback: localStorage listener
    const storageListener = (e: StorageEvent) => {
      if (e.key === 'auth-logout') {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (resubscribeTimerRef.current) {
          clearTimeout(resubscribeTimerRef.current);
        }
        setIsConnected(false);
        setIsLeader(false);
      }
    };
    
    window.addEventListener('storage', storageListener);
    
    return () => {
      authChannel.close();
      window.removeEventListener('storage', storageListener);
    };
  }, []);
  
  return {
    isLeader,
    isConnected,
    lastEventTime,
  };
}

// Utilities
function randomInRange([min, max]: [number, number]): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendTelemetry(eventType: string, data: any) {
  try {
    await fetch('/telemetry/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        timestamp: Date.now(),
        domain: '<domain>',
        ...data,
      }),
    });
  } catch {
    // Silently fail
  }
}
```

---

## 🔗 Phase 3: Page Integration (2-3 hours)

### 3.1: React Query Cache Patching

**File:** `frontend/pages/<Page>Page.tsx`

```typescript
import { use<Domain>RealtimeV2 } from '@/hooks/use<Domain>RealtimeV2';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import type { <Domain>Event } from '@/types/<domain>';

export default function <Page>Page() {
  const queryClient = useQueryClient();
  const propertyId = useCurrentPropertyId(); // Your hook
  
  // Debounce helper for aggregates
  const debouncedInvalidate = useDebouncedInvalidate(queryClient);
  const processedEventIds = useRef(new Set<string>());
  
  // Event handler
  const handleRealtimeEvents = useCallback((events: <Domain>Event[]) => {
    events.forEach(event => {
      // Deduplicate
      if (processedEventIds.current.has(event.eventId)) {
        return;
      }
      processedEventIds.current.add(event.eventId);
      
      // Cleanup old IDs (keep last 1000)
      if (processedEventIds.current.size > 1000) {
        const oldIds = Array.from(processedEventIds.current).slice(0, 100);
        oldIds.forEach(id => processedEventIds.current.delete(id));
      }
      
      // Patch row-level caches
      switch (event.eventType) {
        case '<Domain>Created':
          // Add to list
          queryClient.setQueryData(['<domain>', 'list'], (old: any[]) => {
            if (!old) return [event.payload];
            return [event.payload, ...old];
          });
          
          // Set individual item
          queryClient.setQueryData(
            ['<domain>', event.payload.<entityId>],
            event.payload
          );
          break;
          
        case '<Domain>Updated':
          // Update list item
          queryClient.setQueryData(['<domain>', 'list'], (old: any[]) => {
            if (!old) return [];
            return old.map(item =>
              item.<entityId> === event.payload.<entityId> ? event.payload : item
            );
          });
          
          // Update individual item
          queryClient.setQueryData(
            ['<domain>', event.payload.<entityId>],
            event.payload
          );
          break;
          
        case '<Domain>Deleted':
          // Remove from list
          queryClient.setQueryData(['<domain>', 'list'], (old: any[]) => {
            if (!old) return [];
            return old.filter(item => item.<entityId> !== event.payload.<entityId>);
          });
          
          // Remove individual item
          queryClient.removeQueries({
            queryKey: ['<domain>', event.payload.<entityId>]
          });
          break;
      }
      
      // Debounced aggregate invalidations
      debouncedInvalidate(['<domain>', 'summary'], 1000);
      debouncedInvalidate(['<domain>', 'stats'], 1500);
    });
  }, [queryClient, debouncedInvalidate]);
  
  // Hook usage
  const { isConnected, isLeader } = use<Domain>RealtimeV2({
    propertyId,
    enabled: true,
    onEvents: handleRealtimeEvents,
  });
  
  // Dynamic staleTime based on connection
  const staleTime = isConnected ? 25_000 : 10_000;
  
  // Your queries with adjusted staleTime
  const { data: items, isLoading } = useQuery({
    queryKey: ['<domain>', 'list'],
    queryFn: fetch<Domain>List,
    staleTime,
    refetchOnWindowFocus: true, // Resiliency when realtime fails
  });
  
  const { data: summary } = useQuery({
    queryKey: ['<domain>', 'summary'],
    queryFn: fetch<Domain>Summary,
    staleTime: isConnected ? 30_000 : 15_000,
  });
  
  // Rest of your page...
}

// Debounce utility
function useDebouncedInvalidate(queryClient: any) {
  const timers = useRef(new Map<string, NodeJS.Timeout>());
  
  return useCallback((queryKey: any[], delayMs: number) => {
    const key = JSON.stringify(queryKey);
    
    if (timers.current.has(key)) {
      clearTimeout(timers.current.get(key)!);
    }
    
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey });
      timers.current.delete(key);
    }, delayMs);
    
    timers.current.set(key, timer);
  }, [queryClient]);
}
```

### 3.2: Degraded Mode (Offline Fallback)

```typescript
// Add to page component
const HARD_TIMEOUT_MS = 60_000; // 1 minute

useEffect(() => {
  if (!isConnected) {
    const timer = setTimeout(() => {
      // Trigger safe refetch
      queryClient.invalidateQueries({ queryKey: ['<domain>'] });
    }, HARD_TIMEOUT_MS);
    
    return () => clearTimeout(timer);
  }
}, [isConnected, queryClient]);
```

---

## 🔐 Phase 4: Auth & Session Lifecycle (1-2 hours)

### 4.1: Verify Global Auth Patterns

**Checklist:**
- [ ] `frontend/contexts/AuthContext.tsx` has:
  - ✅ Refresh mutex (Web Locks or localStorage)
  - ✅ `BroadcastChannel('auth-refresh')` for token sharing
  - ✅ `BroadcastChannel('auth-control')` for logout broadcast
  - ✅ Exponential backoff on repeated 401s
  - ✅ No `Authorization` header when token is missing

- [ ] `frontend/components/GlobalAuthBanner.tsx` exists and shows:
  - Expired mode: Red banner with [Log in] and [Reload]
  - Offline mode: Yellow banner with [Try again]

- [ ] `frontend/components/Layout.tsx`:
  - ✅ Renders `<GlobalAuthBanner />`
  - ✅ Disables interactions while banner is visible (via context)

### 4.2: Token Read at Send Time

**Ensure in your hook:**

```typescript
// ✅ CORRECT: Read token at send time
const { token } = useAuth();

useEffect(() => {
  if (!token) {
    // Don't subscribe; pause
    return;
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Only add Authorization if token exists and is non-empty
  if (token && token.length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  // Make request...
}, [token]);
```

---

## 🛠️ Phase 5: Dev Environment (30 minutes)

### 5.1: Vite Dev Proxy

**File:** `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  // ... other config
  
  server: {
    port: 5173,
    proxy: {
      // Add narrow proxy for realtime endpoint
      '/<domain>/realtime': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // DO NOT proxy the entire /<domain> path (breaks SPA routing)
    },
  },
});
```

### 5.2: Environment Variables

**File:** `frontend/.env.development`

```bash
VITE_API_URL=http://localhost:4000
```

**File:** `frontend/.env.production`

```bash
VITE_API_URL=https://api.yourdomain.com
```

---

## 📊 Phase 6: Observability (1-2 hours)

### 6.1: Metrics Endpoint Usage

Test locally:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/<domain>/realtime/metrics
```

Expected response:

```json
{
  "orgs": {
    "total": 1234,
    "active_last_5m": 567
  },
  "events": {
    "published_total": 45678,
    "delivered_total": 45200,
    "dropped_total": 12
  },
  "buffers": {
    "total_size": 3456,
    "avg_per_org": 2.8
  },
  "subscribers": {
    "active_count": 567
  }
}
```

### 6.2: Client Telemetry

Events sent to `POST /telemetry/client` (2% sample rate):

- `fast_empty`: Subscribe returned empty in <1.5s
- `leader_acquired`: Tab became leader
- `leader_takeover`: Tab took over from inactive leader
- `subscribe_error`: Non-abort error (with status code)

### 6.3: Logging Verification

**Backend logs to look for:**

```
[RealtimeSubscribe][completed] orgId=123 userId=456 propertyId=all events=3 durationMs=245 origin=http://localhost:5173 ua="Mozilla/5.0..."
[RealtimeSubscribe][completed] orgId=123 userId=456 propertyId=all events=0 durationMs=25003 origin=http://localhost:5173 ua="Mozilla/5.0..."
```

---

## ✅ Testing & Validation (Mandatory)

### Test Scenario 1: Multi-Tab Leader Election

**Steps:**
1. Open 5 tabs of your app (all logged in)
2. Open DevTools Network tab in each
3. Filter for `/<domain>/realtime/subscribe`

**Expected:**
- ✅ Only 1 tab shows active `subscribe` requests
- ✅ Other 4 tabs show no `subscribe` requests
- ✅ Close the leader tab
- ✅ Within 3-5 seconds, a new leader emerges
- ✅ New leader starts showing `subscribe` requests

### Test Scenario 2: Event Delivery

**Steps:**
1. Open 2 tabs (Tab A, Tab B)
2. In Tab A, create a new <entity> (e.g., task, staff member)
3. Observe Tab B

**Expected:**
- ✅ Tab B updates within <2 seconds
- ✅ New entity appears without manual refresh
- ✅ No duplicate entries (check React DevTools)

### Test Scenario 3: Auth Expiry

**Steps:**
1. Open 3 tabs
2. In localStorage, set token expiry to past time:
   ```javascript
   localStorage.setItem('auth-expiry', Date.now() - 10000);
   ```
3. Trigger an API call (create/update)

**Expected:**
- ✅ Only 1 refresh request sent across all tabs
- ✅ Other tabs pause and resume with new token
- ✅ On repeated failure, global banner appears
- ✅ Retry backoff: 2s → 4s → 8s → ... → 60s (max)

### Test Scenario 4: Logout Broadcast

**Steps:**
1. Open Tab A and Tab B (both logged in)
2. Open DevTools Network in Tab B, filter for `subscribe`
3. In Tab A, click Logout

**Expected:**
- ✅ Tab B's active `subscribe` request aborts immediately (<200ms)
- ✅ No new `subscribe` requests appear in Tab B
- ✅ Zero "jwt malformed" errors in console
- ✅ Tab B either navigates to `/login` or shows session banner

### Test Scenario 5: Fast-Empty Behavior

**Steps:**
1. Open 1 tab
2. Do NOT create any events (leave idle)
3. Observe Network timing for `subscribe` requests

**Expected:**
- ✅ First few requests complete in 25-26 seconds (idle timeout)
- ✅ After fast-empty detection, next request delayed 2-5 seconds
- ✅ Steady-state: ~30-second intervals (25s wait + 2-5s backoff)

### Test Scenario 6: Performance Under Burst

**Steps:**
1. Open 1 tab
2. Rapidly create 50 <entities> (use script or UI)
3. Monitor DevTools Performance tab

**Expected:**
- ✅ All 50 items appear in list instantly
- ✅ Aggregate queries (summary, stats) fire ≤ 1 time/second
- ✅ No lag or UI freeze
- ✅ Check `/realtime/metrics`: `dropped_total` should be 0

### Test Scenario 7: Offline/Online

**Steps:**
1. Open 1 tab
2. Open DevTools → Network → Throttle to "Offline"
3. Wait 5 seconds
4. Set back to "Online"

**Expected:**
- ✅ Offline banner appears (yellow) after ~5s
- ✅ `subscribe` requests stop
- ✅ When back online, banner disappears
- ✅ `subscribe` requests resume
- ✅ Page refetches data

---

## 🎯 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Idle long-poll duration** | ~25 seconds | DevTools Network: subscribe request timing |
| **Leader count** | = Active sessions (not tabs) | Open 10 tabs → only 1-2 leaders |
| **Derived query rate (burst)** | ≤ 1/second | Create 50 events → summary fires ~5 times |
| **CORS preflight volume** | < 10% of requests | DevTools Network: filter OPTIONS requests |
| **Buffer size** | < `MAX_BUFFER_SIZE` | `/realtime/metrics`: `buffers.total_size` |
| **Dropped events** | 0 under normal load | `/realtime/metrics`: `events.dropped_total` |
| **Logout propagation** | < 200ms | Logout in Tab 1 → Tab 2 stops immediately |

---

## 🔄 Rollback Plan

### Feature Flag Setup

**File:** `backend/<domain>/config.ts`

```typescript
export const ENABLE_<DOMAIN>_REALTIME_V2 = 
  process.env.ENABLE_<DOMAIN>_REALTIME_V2 === 'true' || 
  process.env.NODE_ENV === 'development';
```

**File:** `frontend/hooks/use<Domain>RealtimeV2.ts`

```typescript
const ENABLED_FLAG = localStorage.getItem('<domain>-realtime-v2-enabled');
const isFeatureEnabled = ENABLED_FLAG !== 'false'; // Opt-out

export function use<Domain>RealtimeV2(options: RealtimeOptions = {}) {
  const effectiveEnabled = options.enabled && isFeatureEnabled;
  // ... rest of hook
}
```

### Rollback Procedure

**If issues arise post-deployment:**

1. **Backend:** Set environment variable:
   ```bash
   ENABLE_<DOMAIN>_REALTIME_V2=false
   ```

2. **Frontend:** Instruct users (or set via remote config):
   ```javascript
   localStorage.setItem('<domain>-realtime-v2-enabled', 'false');
   ```

3. **Monitor:** Check for drop in error rates

4. **Restore old implementation:** If needed, revert to legacy polling temporarily

### Monitoring During Rollout

- **First 24 hours:** Monitor error rates, 401/403 spikes, buffer metrics
- **First week:** Verify no memory leaks, CPU usage normal, latency acceptable
- **After 2 weeks:** If stable, remove legacy implementation and feature flags

---

## 📝 Documentation

### Updates Required

#### 1. File Index

**File:** `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md`

Add to **Section 10: File Index**:

```markdown
### <Domain> Service

- Backend
  - `backend/<domain>/realtime_buffer.ts`
  - `backend/<domain>/realtime_subscriber.ts`
  - `backend/<domain>/subscribe_realtime.ts`
  - `backend/<domain>/realtime_metrics.ts`
  
- Frontend
  - `frontend/hooks/use<Domain>RealtimeV2.ts`
  - `frontend/pages/<Page>Page.tsx` (integration)
```

#### 2. Operational Checklist

**File:** `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md`

Add to **Section 9: Operational Checklists**:

```markdown
### <Domain> Service QA

- [ ] `GET /<domain>/realtime/metrics` returns valid metrics
- [ ] Only one subscribe per session (multi-tab test)
- [ ] Events deliver to all tabs within 2 seconds
- [ ] Logout stops all tabs within 200ms
- [ ] Aggregate queries fire ≤ 1/sec during bursts
- [ ] No "jwt malformed" errors in console
```

#### 3. Inline JSDoc

Add JSDoc comments to all exported functions:

```typescript
/**
 * Push domain event to org buffer; wakes waiting subscribers
 * @param orgId - Organization ID
 * @param propertyId - Optional property filter
 * @param event - Domain event with eventId, timestamp, payload
 */
export function pushEvent(orgId: string, propertyId: string | undefined, event: <Domain>Event): void {
  // ...
}
```

---

## 🚀 Implementation Checklist

### Pre-Implementation
- [ ] Completed Prerequisites section
- [ ] Read reference documentation
- [ ] Reviewed Finance implementation
- [ ] No conflicting realtime implementations exist

### Backend
- [ ] Created event types & schema
- [ ] Implemented in-memory buffer
- [ ] Created realtime subscriber
- [ ] Implemented subscribe endpoint
- [ ] Added metrics endpoint
- [ ] Deprecated legacy endpoints (if applicable)
- [ ] Verified CORS configuration

### Frontend
- [ ] Created `use<Domain>RealtimeV2` hook
- [ ] Implemented leader/follower pattern
- [ ] Added RTT-aware backoff
- [ ] Implemented auth-control listener
- [ ] Added client telemetry (2% sample)
- [ ] Configured Vite dev proxy

### Page Integration
- [ ] Integrated hook in page component
- [ ] Implemented row-level cache patching
- [ ] Added debounced aggregate invalidations
- [ ] Adjusted staleTime based on connection
- [ ] Added degraded mode (offline fallback)
- [ ] Verified auth banner integration

### Testing
- [ ] Passed Test Scenario 1 (Multi-tab leader)
- [ ] Passed Test Scenario 2 (Event delivery)
- [ ] Passed Test Scenario 3 (Auth expiry)
- [ ] Passed Test Scenario 4 (Logout broadcast)
- [ ] Passed Test Scenario 5 (Fast-empty)
- [ ] Passed Test Scenario 6 (Performance burst)
- [ ] Passed Test Scenario 7 (Offline/online)

### Performance
- [ ] Met all performance targets
- [ ] Verified metrics endpoint
- [ ] Confirmed buffer health
- [ ] Zero dropped events under normal load

### Documentation
- [ ] Updated File Index
- [ ] Updated Operational Checklists
- [ ] Added inline JSDoc
- [ ] Created rollback procedure

### Deployment
- [ ] Feature flag configured
- [ ] Rollback plan documented
- [ ] Monitoring alerts set up
- [ ] Ready for production

---

## 🆘 Troubleshooting

### Issue: Multiple tabs all long-polling

**Symptoms:** Network tab shows `subscribe` requests in all tabs

**Diagnosis:**
- Leader election not working
- Web Locks API not supported and localStorage fallback failing

**Fix:**
1. Check browser compatibility: `'locks' in navigator`
2. Verify localStorage not disabled (private mode)
3. Check console for lease acquisition errors
4. Add debug logs to `acquireLease()`

### Issue: "jwt malformed" errors

**Symptoms:** Console shows JWT parsing errors, especially during logout

**Diagnosis:**
- Sending empty or malformed `Authorization` header
- Token not cleared on logout

**Fix:**
1. Ensure token guard:
   ```typescript
   if (token && token.length > 0) {
     headers.Authorization = `Bearer ${token}`;
   }
   ```
2. Listen to `auth-control` logout and stop immediately
3. Clear token in AuthContext before broadcasting logout

### Issue: Events not appearing in follower tabs

**Symptoms:** Leader tab updates, but followers don't

**Diagnosis:**
- BroadcastChannel not working
- Leader not broadcasting events

**Fix:**
1. Verify `channelRef.current.postMessage({ type: 'events', events })`
2. Check BroadcastChannel name matches: `'<domain>-events'`
3. Ensure followers have `channel.onmessage` listener

### Issue: High 401 error rates

**Symptoms:** Repeated 401s in Network tab, even after refresh

**Diagnosis:**
- Token refresh mutex not working
- Multiple tabs refreshing simultaneously

**Fix:**
1. Verify refresh mutex in AuthContext (Web Locks or localStorage)
2. Check `auth-refresh` BroadcastChannel sharing
3. Add exponential backoff with max 60s

### Issue: Buffer overflow / dropped events

**Symptoms:** `metrics.events.dropped_total` increasing

**Diagnosis:**
- Events published faster than consumed
- Buffer size too small for burst traffic

**Fix:**
1. Increase `MAX_BUFFER_SIZE` (default 200)
2. Reduce `EVENT_TTL_MS` to evict faster
3. Check for slow subscribers (logging duration)
4. Consider batching events on publisher side

### Issue: Memory leak / growing buffer

**Symptoms:** Backend memory usage increases over time

**Diagnosis:**
- Idle eviction not working
- Org buffers not cleaned up

**Fix:**
1. Verify `ORG_IDLE_EVICT_MS` (default 2 min)
2. Check `setInterval` cleanup is running
3. Ensure waiters are properly resolved/timeout
4. Monitor `metrics.orgs.total` growth

---

## 📚 Additional Resources

- **Reference Playbook:** [NETWORKING_AND_REALTIME_IMPROVEMENTS.md](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)
- **Finance Implementation:** `backend/finance/realtime_*.ts`, `frontend/hooks/useFinanceRealtimeV2.ts`
- **Encore Documentation:** [https://encore.dev/docs](https://encore.dev/docs)
- **React Query:** [https://tanstack.com/query](https://tanstack.com/query)
- **Web Locks API:** [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- **BroadcastChannel:** [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)

---

## ✅ Definition of Done

This implementation is complete when:

1. ✅ All checklist items are complete
2. ✅ All test scenarios pass
3. ✅ All performance targets are met
4. ✅ Documentation is updated
5. ✅ Code passes linting and type checks
6. ✅ Rollback plan is documented and tested
7. ✅ Monitoring is in place
8. ✅ Team has reviewed the implementation
9. ✅ Ready for production deployment

---

**Next Steps:**

1. Fill in the Prerequisites section with your domain details
2. Follow phases 1-6 in order
3. Complete all test scenarios
4. Update documentation
5. Deploy with feature flags
6. Monitor for 24-48 hours
7. Remove legacy implementation once stable

**Questions or Issues?**

- Review Finance implementation for working examples
- Check Troubleshooting section for common issues
- Consult with team leads for architecture questions
- Reference NETWORKING_AND_REALTIME_IMPROVEMENTS.md for patterns

---

**Template End** – Replace `<DOMAIN>`, `<Domain>`, `<domain>`, `<Page>`, `<entity>`, `<entityId>` with your actual values throughout this document.




