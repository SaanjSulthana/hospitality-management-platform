/**
 * RealtimeProvider V2 - WebSocket Streaming (CORRECTED VERSION)
 * 
 * FIXES APPLIED:
 * ✅ Proper WebSocket auth using Encore's generated client
 * ✅ Cleaner connection lifecycle
 * ✅ Fixed reconnection logic
 * ✅ Proper cleanup
 * 
 * NOTE: This uses Encore's generated client which handles auth automatically.
 * If using raw WebSocket, token must be passed via query param or cookie.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../src/config/api';
import { getAccessTokenHash, getFlagBool, getFlagNumber } from '../lib/feature-flags';
import Client from '../src/client';

/**
 * Service names
 */
type ServiceName =
  | 'finance'
  | 'guest'
  | 'staff'
  | 'tasks'
  | 'properties'
  | 'users'
  | 'dashboard'
  | 'branding'
  | 'analytics'
  | 'reports';

/**
 * WebSocket handshake
 */
interface StreamHandshake {
  services: ServiceName[];
  version: number;
  filters?: {
    propertyId?: number | null;
  };
  lastSeq?: number;
}

/**
 * Stream message from server
 */
interface StreamMessage {
  service: ServiceName;
  events: any[];
  timestamp: string;
  seq: number;
  // Include 'batch' to match server-side StreamOutMessage.type
  type: 'event' | 'ping' | 'ack' | 'error' | 'batch';
  error?: {
    message: string;
    code?: string;
    service?: ServiceName;
  };
}

/**
 * Dedup cache (Enhanced with timestamps)
 */
interface OrgDedupState {
  entries: Map<string, number>; // eventId → timestamp
  order: string[];
  lastAccess: number;
  lastCleanup: number;
}

/**
 * Configuration (Enhanced with backoff cap and jitter)
 */
const CONFIG = {
  PING_TIMEOUT_MS: 60_000,
  RECONNECT_DELAYS: [1000, 2000, 5000, 10000, 30000, 60000, 120000], // Up to 2 minutes
  MAX_BACKOFF_MS: 300_000, // 5 minutes max
  JITTER_MS: 5000, // ±5s randomization
  MAX_CACHE_ORGS: 3,
  MAX_CACHE_IDS: 1000,
  DEDUP_TTL_MS: 5 * 60 * 1000, // 5 minutes
  TAKEOVER_MS: 3000,
  HEARTBEAT_INTERVAL_MS: 1000,
} as const;

/**
 * Health metrics interface
 */
interface HealthMetrics {
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
  lastConnectedAt: number;
  lastDisconnectedAt: number;
  totalDisconnects: number;
  reconnectAttempts: number;
  eventsReceived: number;
  eventLatencyMs: number[]; // Rolling window of last 100 samples
  duplicatesDetected: number;
  lastEventAt: number;
  connectionUptime: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  // Per-service counters (lightweight)
  byServiceDelivered?: Record<string, number>;
  byServiceSuppressed?: Record<string, number>;
}

/**
 * RealtimeProvider V2 - Fixed Version
 */
export default function RealtimeProviderV2Fixed(): null {
  const { user } = useAuth();
  const location = useLocation();

  // Feature flags
  // Production: force realtime ON, with an emergency kill switch; in dev respect local flags.
  const IS_PRODUCTION = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.PROD === true;
  const EMERGENCY_KILL = getFlagBool('REALTIME_EMERGENCY_DISABLE', false);
  const masterEnabled = !EMERGENCY_KILL && (IS_PRODUCTION ? true : getFlagBool('REALTIME_STREAMING_V2', true));
  // Disable leader election by default for stability; can be re-enabled via FIN_LEADER_ENABLED=true
  const leaderEnabled = getFlagBool('FIN_LEADER_ENABLED', false);
  const rolloutPercent = getFlagNumber('REALTIME_ROLLOUT_PERCENT', 100);

  // Connection state
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeqRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeaderRef = useRef<boolean>(false);
  const suspendedRef = useRef<boolean>(false);
  const connectingRef = useRef<boolean>(false);
  // Track last services and debounce service/property-driven reconnects
  const serviceChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServicesRef = useRef<string>('');

  // Dedup cache
  const dedupCacheRef = useRef<Map<number, OrgDedupState>>(new Map());

  // Health metrics
  const metricsRef = useRef<HealthMetrics>({
    connectionState: 'disconnected',
    lastConnectedAt: 0,
    lastDisconnectedAt: 0,
    totalDisconnects: 0,
    reconnectAttempts: 0,
    eventsReceived: 0,
    eventLatencyMs: [],
    duplicatesDetected: 0,
    lastEventAt: 0,
    connectionUptime: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    byServiceDelivered: {},
    byServiceSuppressed: {},
  });

  // Broadcast channels
  const leaderChannelRef = useRef<BroadcastChannel | null>(null);
  // Shared cross-tab events channel (per org)
  const eventsChannelRef = useRef<BroadcastChannel | null>(null);

  const tokenHash = getAccessTokenHash();
  const orgId = (user as any)?.orgId ?? (user as any)?.organizationId ?? null;
  const tabId = useRef<string>('');
  // Property filter propagated by pages
  const [subscribedPropertyId, setSubscribedPropertyId] = useState<number | null>(null);

  /**
   * Initialize tab ID
   */
  useEffect(() => {
    try {
      const existing = sessionStorage.getItem('realtime-tab-id');
      if (existing) {
        tabId.current = existing;
      } else {
        const id = Math.random().toString(36).slice(2);
        sessionStorage.setItem('realtime-tab-id', id);
        tabId.current = id;
      }
    } catch {
      tabId.current = Math.random().toString(36).slice(2);
    }
  }, []);

  /**
   * Route → Service map (corrected)
   */
  const ROUTE_SERVICE_MAP: Record<string, ServiceName[]> = {
    '/finance': ['finance', 'properties', 'reports'],
    '/dashboard': ['finance', 'properties', 'tasks', 'users', 'dashboard', 'analytics'],
    '/staff': ['staff', 'properties', 'users'],
    '/guest-checkin': ['guest', 'properties'],
    '/tasks': ['tasks', 'properties', 'users'],
    '/task-management': ['tasks', 'staff', 'properties', 'users'],
    '/properties': ['properties'],
    '/users': ['users', 'properties'],
    '/analytics': ['analytics', 'finance', 'properties'],
    '/reports': ['reports', 'finance', 'properties'],
    '/settings': ['branding'],
  };

  const DEFAULT_SERVICES: ServiceName[] = [
    'finance', 'guest', 'staff', 'tasks', 'properties', 'users', 'dashboard', 'branding', 'analytics', 'reports',
  ];

  const resolveServicesForPath = (pathname: string): ServiceName[] => {
    if (!pathname) return DEFAULT_SERVICES;
    let bestMatch: string | null = null;
    for (const base in ROUTE_SERVICE_MAP) {
      if (pathname === base || pathname.startsWith(base + '/')) {
        if (bestMatch == null || base.length > bestMatch.length) bestMatch = base;
      }
    }
    return (bestMatch && ROUTE_SERVICE_MAP[bestMatch]) ? ROUTE_SERVICE_MAP[bestMatch] : DEFAULT_SERVICES;
  };

  /**
   * Suspend/Resume transport via global events to free browser connections
   */
  useEffect(() => {
    let currentSuspendReason: string | null = null;

    const onSuspend = (e?: Event) => {
      try {
        suspendedRef.current = true;
        try {
          const detail: any = (e as any)?.detail || {};
          currentSuspendReason = typeof detail?.reason === 'string' ? detail.reason : null;
        } catch {}
        // Close active socket to immediately free the slot
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      } catch {}
    };
    const onResume = () => {
      if (!suspendedRef.current) return;
      suspendedRef.current = false;
      currentSuspendReason = null;
      // Reset backoff attempts and reconnect immediately
      reconnectAttemptsRef.current = 0;
      connect();
    };
    window.addEventListener('realtime:suspend', onSuspend);
    window.addEventListener('realtime:resume', onResume);

    // Context-aware watchdog: only resume if visible and not critical suspend
    const watchdog = setInterval(() => {
      if (!suspendedRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (currentSuspendReason === 'upload' || currentSuspendReason === 'payment') return;
      try { window.dispatchEvent(new CustomEvent('realtime:resume')); } catch {}
    }, 60_000);

    return () => {
      clearInterval(watchdog);
      window.removeEventListener('realtime:suspend', onSuspend);
      window.removeEventListener('realtime:resume', onResume);
    };
  }, []);

  /**
   * Visibility reconnect
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !suspendedRef.current) {
        reconnectAttemptsRef.current = 0;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [orgId, masterEnabled]);

  /**
   * Property filter events from pages → handshake
   */
  useEffect(() => {
    const handler = (e: any) => {
      const nextId = (e?.detail?.propertyId ?? null) as number | null;
      if (nextId === subscribedPropertyId) return;
      setSubscribedPropertyId(nextId);
      if (serviceChangeTimerRef.current) clearTimeout(serviceChangeTimerRef.current);
      serviceChangeTimerRef.current = setTimeout(() => {
        try {
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        } catch {}
        connectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        connect();
      }, 500);
    };
    window.addEventListener('realtime:set-property', handler as EventListener);
    return () => window.removeEventListener('realtime:set-property', handler as EventListener);
  }, [subscribedPropertyId, masterEnabled]);

  /**
   * Check if org is in rollout
   */
  const isInRollout = (oid: number | null): boolean => {
    if (oid == null) return false;
    const percent = Math.max(0, Math.min(100, rolloutPercent));
    if (percent >= 100) return true;
    if (percent <= 0) return false;

    const bucket = (oid * 9301 + 49297) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };

  /**
   * Clean up dedup cache (LRU)
   */
  const cleanupDedupCache = (): void => {
    const cache = dedupCacheRef.current;

    if (cache.size > CONFIG.MAX_CACHE_ORGS) {
      const sortedOrgs = Array.from(cache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      const toRemove = sortedOrgs.slice(0, cache.size - CONFIG.MAX_CACHE_ORGS);
      for (const [oid] of toRemove) {
        cache.delete(oid);
      }
    }

    for (const [oid, state] of cache.entries()) {
      while (state.order.length > CONFIG.MAX_CACHE_IDS) {
        const oldest = state.order.shift();
        // OrgDedupState stores IDs in the `entries` Map, not `ids`
        if (oldest) state.entries.delete(oldest);
      }
    }
  };

  /**
   * Check if event is duplicate (Enhanced with time-based expiry)
   */
  const isDuplicate = (oid: number, dedupKey: string): boolean => {
    const now = Date.now();
    const cache = dedupCacheRef.current;
    let state = cache.get(oid);

    if (!state) {
      state = { 
        entries: new Map(), 
        order: [], 
        lastAccess: now,
        lastCleanup: now,
      };
      cache.set(oid, state);
    }

    state.lastAccess = now;

    // Periodic time-based cleanup (FIX: Dedup cache expiry)
    if (now - state.lastCleanup > 60_000) { // Every minute
      const cutoff = now - CONFIG.DEDUP_TTL_MS;
      for (const [id, timestamp] of state.entries.entries()) {
        if (timestamp < cutoff) {
          state.entries.delete(id);
          const idx = state.order.indexOf(id);
          if (idx !== -1) state.order.splice(idx, 1);
        }
      }
      state.lastCleanup = now;
    }

    // Empty key means "do not dedup"
    if (!dedupKey) {
      return false;
    }

    // Check duplicate for this service
    if (state.entries.has(dedupKey)) {
      metricsRef.current.duplicatesDetected++;
      return true;
    }

    // Store with timestamp
    state.entries.set(dedupKey, now);
    state.order.push(dedupKey);

    // Size-based cleanup
    while (state.order.length > CONFIG.MAX_CACHE_IDS) {
      const oldest = state.order.shift();
      if (oldest) state.entries.delete(oldest);
    }

    cleanupDedupCache();

    return false;
  };

  /**
   * Dispatch events
   */
  const dispatchEvents = (service: ServiceName, events: any[], seqForBatch?: number): void => {
    if (!events || events.length === 0) return;

    // Optional kill switch for dedup to help diagnose field issues in prod without redeploy
    const DEDUP_DISABLED = getFlagBool('REALTIME_DEDUP_DISABLED', false);

    let suppressed = 0;
    const filtered = events.filter((event) => {
      if (DEDUP_DISABLED) return true;

      // Build robust dedup key:
      // 1) Prefer eventId (global id) + service + entityType, to avoid cross-service collisions
      // 2) Fallback: if no eventId, and seqForBatch is provided, dedup using sequence
      // 3) Final fallback: no key => do not dedup
      let key = '';
      const eid = (event as any)?.eventId as string | undefined;
      const entityType = (event as any)?.entityType as string | undefined;
      if (typeof eid === 'string' && eid.length > 0) {
        key = `${service}:${entityType ?? ''}:${eid}`;
      } else if (typeof seqForBatch === 'number' && Number.isFinite(seqForBatch)) {
        key = `${service}:seq:${seqForBatch}`;
      }

      const isDup = isDuplicate(orgId, key);
      if (isDup) suppressed++;
      return !isDup;
    });

    if (filtered.length === 0) return;

    if (suppressed > 0 && import.meta.env.DEV) {
      console.warn('[RealtimeV2Fixed][dedup-suppressed]', { service, suppressed, total: events.length, orgId });
    }

    // Update per-service counters
    try {
      const svc = String(service);
      const met = metricsRef.current;
      met.byServiceSuppressed![svc] = (met.byServiceSuppressed?.[svc] || 0) + suppressed;
      met.byServiceDelivered![svc] = (met.byServiceDelivered?.[svc] || 0) + filtered.length;
    } catch {}

    // Local dispatch for this tab
    window.dispatchEvent(
      new CustomEvent(`${service}-stream-events`, {
        detail: { events: filtered },
      })
    );

    // Broadcast to follower tabs (leader only) to avoid extra WebSocket load
    if (isLeaderRef.current && eventsChannelRef.current) {
      try {
        eventsChannelRef.current.postMessage({
          service,
          events: filtered,
          timestamp: Date.now(),
        });

        if (import.meta.env.DEV) {
          console.log('[RealtimeV2Fixed][broadcast]', {
            service,
            count: filtered.length,
            orgId,
          });
        }
      } catch (err) {
        console.error('[RealtimeV2Fixed][broadcast-error]', err);
      }
    }

    // Health indicator for this service
    window.dispatchEvent(
      new CustomEvent(`${service}-stream-health`, {
        detail: {
          healthy: true,
          lastEventAt: Date.now(),
          eventCount: filtered.length,
        },
      })
    );

    console.log(`[RealtimeV2Fixed][dispatch]`, {
      service,
      total: events.length,
      afterDedup: filtered.length,
      orgId,
    });
  };

  /**
   * Calculate P95 latency
   */
  const calculateP95 = (latencies: number[]): number => {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  };

  /**
   * Handle WebSocket message (Enhanced with latency tracking)
   */
  const handleMessage = (data: string): void => {
    try {
      const message: StreamMessage = JSON.parse(data);

      if (message.seq) {
        lastSeqRef.current = message.seq;
      }

      switch (message.type) {
        case 'event': {
          // Single event message
          if (message.timestamp) {
            const serverTime = new Date(message.timestamp).getTime();
            const clientTime = Date.now();
            const latency = clientTime - serverTime;

            metricsRef.current.eventLatencyMs.push(latency);
            if (metricsRef.current.eventLatencyMs.length > 100) {
              metricsRef.current.eventLatencyMs.shift();
            }
            const latencies = metricsRef.current.eventLatencyMs;
            metricsRef.current.avgLatencyMs =
              latencies.reduce((a, b) => a + b, 0) / latencies.length;
            metricsRef.current.p95LatencyMs = calculateP95(latencies);
          }

          metricsRef.current.eventsReceived++;
          metricsRef.current.lastEventAt = Date.now();

          if (message.service && message.events) {
            dispatchEvents(message.service, message.events, message.seq);
          }
          break;
        }

        case 'batch': {
          // Batch of event messages (server-side batching)
          const innerMessages = (message as any).messages as StreamMessage[] | undefined;

          if (innerMessages && innerMessages.length > 0) {
            for (const m of innerMessages) {
              if (m.timestamp) {
                const serverTime = new Date(m.timestamp).getTime();
                const clientTime = Date.now();
                const latency = clientTime - serverTime;

                metricsRef.current.eventLatencyMs.push(latency);
                if (metricsRef.current.eventLatencyMs.length > 100) {
                  metricsRef.current.eventLatencyMs.shift();
                }
              }

              metricsRef.current.eventsReceived++;
              metricsRef.current.lastEventAt = Date.now();

              if (m.service && m.events) {
                dispatchEvents(m.service, m.events, m.seq);
              }
            }

            const latencies = metricsRef.current.eventLatencyMs;
            if (latencies.length > 0) {
              metricsRef.current.avgLatencyMs =
                latencies.reduce((a, b) => a + b, 0) / latencies.length;
              metricsRef.current.p95LatencyMs = calculateP95(latencies);
            }
          } else if (message.service && message.events) {
            // Fallback: some servers may set events on the batch itself
            dispatchEvents(message.service, message.events, (message as any).seq);
          }
          break;
        }

        case 'ping':
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
          }
          pingTimeoutRef.current = setTimeout(() => {
            console.warn('[RealtimeV2Fixed][ping-timeout]', { orgId });
            if (wsRef.current) {
              wsRef.current.close();
            }
          }, CONFIG.PING_TIMEOUT_MS);
          break;

        case 'ack':
          console.log('[RealtimeV2Fixed][ack]', { seq: message.seq, orgId });
          break;

        case 'error':
          console.error('[RealtimeV2Fixed][server-error]', {
            service: message.error?.service,
            message: message.error?.message,
            orgId,
          });
          break;
      }
    } catch (err) {
      console.error('[RealtimeV2Fixed][parse-error]', {
        error: err instanceof Error ? err.message : String(err),
        data: data.slice(0, 200),
      });
    }
  };

  /**
   * Get reconnection delay with backoff cap and jitter (FIX: Exponential backoff)
   */
  const getReconnectDelay = (attempts: number): number => {
    const baseDelay = CONFIG.RECONNECT_DELAYS[
      Math.min(attempts, CONFIG.RECONNECT_DELAYS.length - 1)
    ];
    
    const cappedDelay = Math.min(baseDelay, CONFIG.MAX_BACKOFF_MS);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * CONFIG.JITTER_MS * 2 - CONFIG.JITTER_MS;
    
    return Math.max(1000, cappedDelay + jitter);
  };

  /**
   * Connect to WebSocket
   * 
   * FIX: Proper auth token handling
   */
  const connect = (): void => {
    if (!masterEnabled || !orgId || !isInRollout(orgId) || suspendedRef.current) {
      return;
    }

    if (!isLeaderRef.current && leaderEnabled) {
      return;
    }

    // Avoid duplicate connects
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return;
      }
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (connectingRef.current) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      console.warn('[RealtimeV2Fixed][no-token]');
      return;
    }

    const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, '');
    const services = resolveServicesForPath(
      location?.pathname ||
        (typeof window !== 'undefined' ? window.location.pathname : '')
    );

    // Track last services used by active connection
    try { lastServicesRef.current = JSON.stringify(services); } catch {}

    console.log('[RealtimeV2Fixed][connecting]', { orgId, lastSeq: lastSeqRef.current, services });
    connectingRef.current = true;

    (async () => {
      try {
        const client = new Client(baseUrl, {
          auth: {
            access_token: token,
            authorization: `Bearer ${token}`,
          },
        });

        // NOTE: The backend StreamHandshake type includes a custom `token` field
        // that isn't in the generated client typings, so we cast to `any` here.
        const stream = await client.realtime.streamRealtimeEvents({
          services,
          version: 1,
          lastSeq: lastSeqRef.current || undefined,
          propertyId: subscribedPropertyId,
          // Backend expects this extra token field for manual auth in unified_stream.ts
          token,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const socket: any = (stream as any).socket;
        if (!socket || !socket.ws) {
          console.error('[RealtimeV2Fixed][no-socket]', { orgId });
          return;
        }

        // Track ws for cleanup
        wsRef.current = socket.ws as WebSocket;

        socket.on('open', () => {
          console.log('[RealtimeV2Fixed][connected]', { orgId });
          reconnectAttemptsRef.current = 0;
          metricsRef.current.connectionState = 'connected';
          metricsRef.current.lastConnectedAt = Date.now();
          metricsRef.current.reconnectAttempts = 0;
          connectingRef.current = false;
        });

        socket.on('error', (error: any) => {
          console.error('[RealtimeV2Fixed][error]', { error, orgId });
          connectingRef.current = false;
        });

        socket.on('close', (event: any) => {
          console.log('[RealtimeV2Fixed][closed]', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            orgId,
          });

          wsRef.current = null;
          connectingRef.current = false;
          metricsRef.current.connectionState = 'disconnected';
          metricsRef.current.lastDisconnectedAt = Date.now();
          metricsRef.current.totalDisconnects++;
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
            pingTimeoutRef.current = null;
          }
          if (masterEnabled && isLeaderRef.current) {
            metricsRef.current.connectionState = 'reconnecting';
            metricsRef.current.reconnectAttempts++;
            const delay = getReconnectDelay(reconnectAttemptsRef.current);
            console.log('[RealtimeV2Fixed][reconnect-scheduled]', {
              delay,
              attempt: reconnectAttemptsRef.current + 1,
              orgId,
            });
            reconnectTimerRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, delay);
          }
        });

        // Consume stream messages using async iterator
        (async () => {
          try {
            for await (const message of stream as any) {
              handleMessage(JSON.stringify(message));
            }
          } catch (err) {
            console.error('[RealtimeV2Fixed][stream-error]', {
              error: err instanceof Error ? err.message : String(err),
              orgId,
            });
          }
        })();
      } catch (err) {
        console.error('[RealtimeV2Fixed][connect-error]', {
          error: err instanceof Error ? err.message : String(err),
          orgId,
        });
        connectingRef.current = false;
        if (masterEnabled && isLeaderRef.current) {
          metricsRef.current.connectionState = 'reconnecting';
          metricsRef.current.reconnectAttempts++;
          const delay = getReconnectDelay(reconnectAttemptsRef.current);
          console.log('[RealtimeV2Fixed][reconnect-scheduled]', {
            delay,
            attempt: reconnectAttemptsRef.current + 1,
            orgId,
          });
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      }
    })();
  };

  /**
   * Route-based services refresh: reconnect when required services change
   */
  useEffect(() => {
    if (!masterEnabled || !orgId) return;
    const newServices = resolveServicesForPath(
      location?.pathname ||
        (typeof window !== 'undefined' ? window.location.pathname : '')
    );
    const next = JSON.stringify(newServices);
    // If this is the very first evaluation and we haven't connected yet,
    // initialize lastServicesRef to avoid an immediate redundant reconnect.
    if (!lastServicesRef.current) {
      lastServicesRef.current = next;
      return;
    }
    if (next !== lastServicesRef.current) {
      if (serviceChangeTimerRef.current) clearTimeout(serviceChangeTimerRef.current);
      serviceChangeTimerRef.current = setTimeout(() => {
        // Force reconnect to apply new services set
        try {
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        } catch {}
        connectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        connect();
      }, 300);
    }
  }, [location.pathname, masterEnabled, orgId]);

  /**
   * Leader election
   */
  useEffect(() => {
    if (!leaderEnabled || !orgId || !masterEnabled) {
      // No leader election: behave as a single leader in this tab
      isLeaderRef.current = true;

      // Still create events channel so future tabs can listen
      const eventsChannel = new BroadcastChannel(`realtime-events-${orgId}`);
      eventsChannelRef.current = eventsChannel;

      eventsChannel.onmessage = (msg) => {
        // In single-leader mode we don't expect follower processing,
        // but guard to avoid accidental loops if flags change.
        if (!msg?.data?.events) return;
        if (!isLeaderRef.current) {
          const age = Date.now() - (msg.data.timestamp || 0);
          if (age < 5000) {
            dispatchEvents(msg.data.service as ServiceName, msg.data.events);
          } else if (import.meta.env.DEV) {
            console.warn('[RealtimeV2Fixed][stale-broadcast]', {
              service: msg.data.service,
              age,
              orgId,
            });
          }
        }
      };

      connect();

      return () => {
        try {
          eventsChannel.close();
        } catch {}
        eventsChannelRef.current = null;
      };
    }

    // Leader-election path (multi-tab)
    const leaderChannel = new BroadcastChannel(`realtime-leader-${orgId}`);
    leaderChannelRef.current = leaderChannel;

    // Events channel shared across all tabs for this org
    const eventsChannel = new BroadcastChannel(`realtime-events-${orgId}`);
    eventsChannelRef.current = eventsChannel;

    // Followers consume events from leader via BroadcastChannel
    eventsChannel.onmessage = (msg) => {
      if (!msg?.data?.events) return;
      // Only non-leader tabs should re-dispatch broadcasts
      if (!isLeaderRef.current) {
        const age = Date.now() - (msg.data.timestamp || 0);
        if (age < 5000) {
          if (import.meta.env.DEV) {
            console.log('[RealtimeV2Fixed][follower-received]', {
              service: msg.data.service,
              count: msg.data.events.length,
              age,
              orgId,
            });
          }
          dispatchEvents(msg.data.service as ServiceName, msg.data.events);
        } else if (import.meta.env.DEV) {
          console.warn('[RealtimeV2Fixed][stale-broadcast]', {
            service: msg.data.service,
            age,
            orgId,
          });
        }
      }
    };

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let lastHeartbeat = 0;

    const tryBecomeLeader = async (): Promise<void> => {
      try {
        if ('locks' in navigator) {
          await (navigator as any).locks.request(
            `realtime-leader-${orgId}`,
            { mode: 'exclusive', ifAvailable: true },
            async (lock: any) => {
              if (!lock) {
                isLeaderRef.current = false;
                return;
              }

              console.log('[RealtimeV2Fixed][leader-acquired]', { orgId, tabId: tabId.current });
              isLeaderRef.current = true;

              connect();

              heartbeatInterval = setInterval(() => {
                try {
                  leaderChannel.postMessage({
                    type: 'heartbeat',
                    tabId: tabId.current,
                    timestamp: Date.now(),
                    seq: lastSeqRef.current,
                  });
                } catch (err: any) {
                  // If the BroadcastChannel was already closed, stop heartbeats quietly.
                  if (err && typeof err === 'object' && (err.name === 'InvalidStateError' || err.message?.includes('Channel is closed'))) {
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    return;
                  }
                  console.warn('[RealtimeV2Fixed][heartbeat-failed]', err);
                  if (heartbeatInterval) clearInterval(heartbeatInterval);
                }
              }, CONFIG.HEARTBEAT_INTERVAL_MS);

              return new Promise<void>((resolve) => {
                (window as any).__realtimeV2Cleanup = () => {
                  if (heartbeatInterval) clearInterval(heartbeatInterval);
                  resolve();
                };
              });
            }
          );
        } else {
          isLeaderRef.current = true;
          connect();
        }
      } catch (err) {
        console.error('[RealtimeV2Fixed][leader-election-error]', {
          error: err instanceof Error ? err.message : String(err),
          orgId,
        });
      }
    };

    leaderChannel.onmessage = (event) => {
      if (event.data.type === 'heartbeat') {
        lastHeartbeat = event.data.timestamp;
        if (!isLeaderRef.current && event.data.seq) {
          lastSeqRef.current = Math.max(lastSeqRef.current, event.data.seq);
        }
      }
    };

    const checkStaleLeader = setInterval(() => {
      if (isLeaderRef.current) return;
      const timeSinceHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceHeartbeat > CONFIG.TAKEOVER_MS) {
        console.log('[RealtimeV2Fixed][takeover-attempt]', { orgId, tabId: tabId.current });
        void tryBecomeLeader();
      }
    }, 1000);

    void tryBecomeLeader();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      clearInterval(checkStaleLeader);
      leaderChannel.close();

      // Clean up shared events channel
      if (eventsChannelRef.current) {
        try {
          eventsChannelRef.current.close();
        } catch {}
        eventsChannelRef.current = null;
      }

      if (isLeaderRef.current && wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
        pingTimeoutRef.current = null;
      }

      if ((window as any).__realtimeV2Cleanup) {
        (window as any).__realtimeV2Cleanup();
        delete (window as any).__realtimeV2Cleanup;
      }
    };
  }, [orgId, tokenHash, masterEnabled, leaderEnabled]);

  /**
   * Expose metrics globally (FIX: Health monitoring)
   */
  useEffect(() => {
    // Update connection uptime periodically
    const uptimeInterval = setInterval(() => {
      if (metricsRef.current.connectionState === 'connected' && metricsRef.current.lastConnectedAt > 0) {
        metricsRef.current.connectionUptime = Date.now() - metricsRef.current.lastConnectedAt;
      }
    }, 1000);

    // Make metrics accessible globally for debugging
    (window as any).__realtimeMetrics = () => {
      const metrics = metricsRef.current;
      return {
        ...metrics,
        avgLatencyMs: metrics.avgLatencyMs.toFixed(2),
        p95LatencyMs: metrics.p95LatencyMs.toFixed(2),
        connectionUptimeSeconds: (metrics.connectionUptime / 1000).toFixed(0),
        eventRate: metrics.eventsReceived / ((Date.now() - metrics.lastConnectedAt) / 1000 || 1),
      };
    };
    (window as any).__realtimeState = () => {
      const services = (() => {
        try {
          return JSON.parse(lastServicesRef.current || '[]');
        } catch { return []; }
      })();
      return {
        connected: !!wsRef.current && wsRef.current.readyState === WebSocket.OPEN,
        lastSeq: lastSeqRef.current,
        lastEventAt: metricsRef.current.lastEventAt,
        services,
        subscribedPropertyId,
        byServiceDelivered: metricsRef.current.byServiceDelivered || {},
        byServiceSuppressed: metricsRef.current.byServiceSuppressed || {},
      };
    };

    return () => {
      clearInterval(uptimeInterval);
      delete (window as any).__realtimeMetrics;
      delete (window as any).__realtimeState;
    };
  }, [subscribedPropertyId]);

  return null;
}

