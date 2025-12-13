import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../src/config/api';
import { envUtils } from '@/src/utils/environment-detector';
import { getAccessTokenHash, getFlagBool, getFlagNumber } from '../lib/feature-flags';

/**
 * RealtimeProvider
 * - Transport-only provider extracted from useFinanceRealtimeV2
 * - One instance for the whole app (mount in Layout)
 * - Responsibilities:
 *   - Single long-poll per browser per org (leader election across tabs)
 *   - Best-effort resign on unmount + passive takeover (3–5s)
 *   - Heartbeat split-brain detection (seq + timestamp)
 *   - LRU dedup (per org) before broadcasting
 *   - Circuit breaker and periodic reconciliation (aggregates only)
 *   - Auth 401/403 pause + resume (no hot loop)
 *   - Broadcast raw events only via window.dispatchEvent('finance-stream-events', { events })
 *   - Expose health via window events for badges (no React context exported yet)
 */
export default function RealtimeProvider(): null {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Settings / flags
  const leaderEnabled = getFlagBool('FIN_LEADER_ENABLED', true);
  // Defaults for provider-only mode: Master ON, Shadow OFF, 100% rollout
  const masterEnabled = getFlagBool('REALTIME_PROVIDER_V2', true);
  const shadowMode = getFlagBool('REALTIME_SHADOW_MODE', false);
  const rolloutPercent = getFlagNumber('REALTIME_ROLLOUT_PERCENT', 100);
  const TAKEOVER_MS = 3000; // passive takeover target
  const TELEMETRY_SAMPLE = 0.02;

  // State refs
  const lastEventIdRef = useRef<string>('');
  const lastSuccessAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const backoffMsRef = useRef<number>(1000);
  const consecutiveFailuresRef = useRef<number>(0);
  const circuitOpenRef = useRef<boolean>(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastResumeAtRef = useRef<number>(0);
  const lastVisibleAtRef = useRef<number>(Date.now());
  const isLeaderRef = useRef<boolean>(false);
  const lastLeaderHeartbeatRef = useRef<number>(0);
  const leaderSeqRef = useRef<number>(0); // monotonic sequence for heartbeats
  const suspendedRef = useRef<boolean>(false);

  // BroadcastChannels
  const leaderChannelRef = useRef<BroadcastChannel | null>(null);
  const eventsChannelRef = useRef<BroadcastChannel | null>(null);
  const guestEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const staffEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const usersEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const propertiesEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const tasksEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const dashboardEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const brandingEventsChannelRef = useRef<BroadcastChannel | null>(null);
  const analyticsEventsChannelRef = useRef<BroadcastChannel | null>(null);

  // Safari private mode degraded path detection (no storage / broadcast)
  const degradedModeRef = useRef<boolean>(false);

  // Feature gating helpers
  const isOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, rolloutPercent));
    if (percent >= 100) return true;
    // Deterministic hash by orgId
    const bucket = (oid * 9301 + 49297) % 233280; // LCG
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };

  // Dedup per-org (keep last 3 orgs)
  type OrgDedupState = { ids: Set<string>; order: string[]; lastAccess: number };
  const dedupMapRef = useRef<Map<number, OrgDedupState>>(new Map());

  // Org / Token / Channels
  const tokenHash = getAccessTokenHash();
  const orgId = (user as any)?.orgId ?? (user as any)?.organizationId ?? null;
  const initialTabId = (() => {
    try {
      const existing = sessionStorage.getItem('finance-tab-id');
      if (existing) return existing;
      const id = Math.random().toString(36).slice(2);
      sessionStorage.setItem('finance-tab-id', id);
      return id;
    } catch {
      return Math.random().toString(36).slice(2);
    }
  })();
  const tabIdRef = useRef<string>(initialTabId);

  // Determine whether to run transport and whether to dispatch events
  const enabledForOrg = !isOrgDisabled(orgId) && isInRollout(orgId);
  const runTransport = (masterEnabled && enabledForOrg) || shadowMode;
  const dispatchEnabled = masterEnabled && enabledForOrg && !shadowMode;

  // Health broadcaster
  const emitHealth = (isLive: boolean) => {
    const evt = new CustomEvent('finance-stream-health', { detail: {
      isLive,
      lastSuccessAt: lastSuccessAtRef.current ? new Date(lastSuccessAtRef.current) : undefined,
      failures: consecutiveFailuresRef.current,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const guestLastSuccessAtRef = useRef<number>(0);
  const emitGuestHealth = (isLive: boolean) => {
    const evt = new CustomEvent('guest-stream-health', { detail: {
      isLive,
      lastSuccessAt: guestLastSuccessAtRef.current ? new Date(guestLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const staffLastSuccessAtRef = useRef<number>(0);
  const emitStaffHealth = (isLive: boolean) => {
    const evt = new CustomEvent('staff-stream-health', { detail: {
      isLive,
      lastSuccessAt: staffLastSuccessAtRef.current ? new Date(staffLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const usersLastSuccessAtRef = useRef<number>(0);
  const emitUsersHealth = (isLive: boolean) => {
    const evt = new CustomEvent('users-stream-health', { detail: {
      isLive,
      lastSuccessAt: usersLastSuccessAtRef.current ? new Date(usersLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const propertiesLastSuccessAtRef = useRef<number>(0);
  const emitPropertiesHealth = (isLive: boolean) => {
    const evt = new CustomEvent('properties-stream-health', { detail: {
      isLive,
      lastSuccessAt: propertiesLastSuccessAtRef.current ? new Date(propertiesLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const tasksLastSuccessAtRef = useRef<number>(0);
  const emitTasksHealth = (isLive: boolean) => {
    const evt = new CustomEvent('tasks-stream-health', { detail: {
      isLive,
      lastSuccessAt: tasksLastSuccessAtRef.current ? new Date(tasksLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const dashboardLastSuccessAtRef = useRef<number>(0);
  const emitDashboardHealth = (isLive: boolean) => {
    const evt = new CustomEvent('dashboard-stream-health', { detail: {
      isLive,
      lastSuccessAt: dashboardLastSuccessAtRef.current ? new Date(dashboardLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const brandingLastSuccessAtRef = useRef<number>(0);
  const emitBrandingHealth = (isLive: boolean) => {
    const evt = new CustomEvent('branding-stream-health', { detail: {
      isLive,
      lastSuccessAt: brandingLastSuccessAtRef.current ? new Date(brandingLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };
  const analyticsLastSuccessAtRef = useRef<number>(0);
  const emitAnalyticsHealth = (isLive: boolean) => {
    const evt = new CustomEvent('analytics-stream-health', { detail: {
      isLive,
      lastSuccessAt: analyticsLastSuccessAtRef.current ? new Date(analyticsLastSuccessAtRef.current) : undefined,
    }});
    try { window.dispatchEvent(evt); } catch {}
  };

  // Helpers
  const now = () => Date.now();
  const jitter = (min: number, max: number) => {
    const d = max - min;
    return Math.floor(min + Math.random() * (d <= 0 ? 0 : d));
  };

  // Leader storage keys & channel names
  const leaseKey = tokenHash && orgId != null ? `finance-leader:${tokenHash}:${orgId}` : null;
  const leaderChannelName = tokenHash && orgId != null ? `finance-leader:${tokenHash}:${orgId}` : null;
  const eventsChannelName = tokenHash && orgId != null ? `finance-events:${tokenHash}:${orgId}` : null;
  const guestEventsChannelName = tokenHash && orgId != null ? `guest-events:${tokenHash}:${orgId}` : null;
  const staffEventsChannelName = tokenHash && orgId != null ? `staff-events:${tokenHash}:${orgId}` : null;
  const usersEventsChannelName = tokenHash && orgId != null ? `users-events:${tokenHash}:${orgId}` : null;
  const propertiesEventsChannelName = tokenHash && orgId != null ? `properties-events:${tokenHash}:${orgId}` : null;
  const tasksEventsChannelName = tokenHash && orgId != null ? `tasks-events:${tokenHash}:${orgId}` : null;
  const dashboardEventsChannelName = tokenHash && orgId != null ? `dashboard-events:${tokenHash}:${orgId}` : null;
  const brandingEventsChannelName = tokenHash && orgId != null ? `branding-events:${tokenHash}:${orgId}` : null;
  const analyticsEventsChannelName = tokenHash && orgId != null ? `analytics-events:${tokenHash}:${orgId}` : null;

  // Resign leadership (best-effort)
  const resignLeadership = () => {
    if (!leaseKey) return;
    try { localStorage.removeItem(leaseKey); } catch {}
    try { leaderChannelRef.current?.postMessage({ t: 'resign', tabId: tabIdRef.current }); } catch {}
    isLeaderRef.current = false;
  };

  // Renew leadership lease
  const renewLease = () => {
    if (!leaseKey) return;
    try {
      const exp = now() + TAKEOVER_MS + Math.floor(Math.random() * 500);
      const lease = { owner: tabIdRef.current, exp };
      localStorage.setItem(leaseKey, JSON.stringify(lease));
    } catch {}
  };

  // Try become leader
  const tryBecomeLeader = (): boolean => {
    if (!leaderEnabled || !leaseKey || degradedModeRef.current) return false;
    try {
      const raw = localStorage.getItem(leaseKey);
      const data = raw ? JSON.parse(raw) : null;
      if (!data || !data.exp || data.exp < now()) {
        renewLease();
        isLeaderRef.current = true;
        sendHeartbeat();
        if (Math.random() < TELEMETRY_SAMPLE) {
          sendClientTelemetry([{ type: data ? 'leader_takeover' : 'leader_acquired', ts: new Date().toISOString() }]);
        }
        return true;
      }
      isLeaderRef.current = false;
      return false;
    } catch {
      renewLease();
      isLeaderRef.current = true;
      sendHeartbeat();
      if (Math.random() < TELEMETRY_SAMPLE) {
        sendClientTelemetry([{ type: 'leader_takeover', ts: new Date().toISOString() }]);
      }
      return true;
    }
  };

  const sendClientTelemetry = (events: any[]) => {
    if (envUtils.isProduction()) return;
    try {
      fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sampleRate: TELEMETRY_SAMPLE, events }),
      }).catch(() => {});
    } catch {}
  };

  // Heartbeat
  const sendHeartbeat = () => {
    try {
      if (!leaderChannelRef.current) return;
      leaderSeqRef.current = (leaderSeqRef.current + 1) | 0;
      leaderChannelRef.current.postMessage({
        t: 'hb',
        at: now(),
        seq: leaderSeqRef.current,
        tabId: tabIdRef.current,
      });
    } catch {}
  };

  // Dedup helpers
  const ensureOrgDedup = (oid: number): OrgDedupState => {
    const m = dedupMapRef.current;
    let s = m.get(oid);
    if (!s) {
      s = { ids: new Set(), order: [], lastAccess: now() };
      m.set(oid, s);
      // Keep only last 3 orgs
      if (m.size > 3) {
        let oldestKey: number | null = null;
        let oldestTime = Infinity;
        for (const [k, v] of m.entries()) {
          if (k === oid) continue;
          if (v.lastAccess < oldestTime) { oldestTime = v.lastAccess; oldestKey = k; }
        }
        if (oldestKey != null) m.delete(oldestKey);
      }
    }
    s.lastAccess = now();
    return s;
  };

  const dedupFilter = (oid: number, events: any[]): any[] => {
    if (oid == null) return events;
    const state = ensureOrgDedup(oid);
    const MAX_IDS = 1000;
    const MAX_AGE_MS = 5 * 60 * 1000;

    const out: any[] = [];
    for (const ev of events) {
      const id = ev?.eventId;
      const ts = ev?.timestamp ? new Date(ev.timestamp).getTime() : 0;
      if (!id) continue;
      if (ts && now() - ts > MAX_AGE_MS) continue;
      if (state.ids.has(id)) continue;
      // admit
      state.ids.add(id);
      state.order.push(id);
      out.push(ev);
      // evict FIFO
      while (state.order.length > MAX_IDS) {
        const rid = state.order.shift();
        if (rid) state.ids.delete(rid);
      }
    }
    return out;
  };

  // Deterministic ordering: sequenceNumber → timestamp → eventId
  const sortEvents = (events: any[]): any[] => {
    return [...events].sort((a, b) => {
      const sa = a?.sequenceNumber ?? null;
      const sb = b?.sequenceNumber ?? null;
      if (sa != null && sb != null && sa !== sb) return sa - sb;
      const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (ta !== tb) return ta - tb;
      const ia = a?.eventId || '';
      const ib = b?.eventId || '';
      return ia.localeCompare(ib);
    });
  };

  // Visibility resume throttling
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      const t = now();
      if (t - lastResumeAtRef.current < 500) return;
      lastResumeAtRef.current = t;
      if (!inFlightRef.current && !circuitOpenRef.current) {
        if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
        nextTimerRef.current = setTimeout(subscribe, 0);
      }
      // If we were hidden for >5 minutes, force a full refresh
      const hiddenMs = t - lastVisibleAtRef.current;
      if (hiddenMs > 5 * 60 * 1000) {
        hardRecover();
      }
      lastVisibleAtRef.current = t;
    } else {
      // Track when we went hidden
      lastVisibleAtRef.current = now();
    }
  };

  const hardRecover = () => {
    try {
      queryClient.invalidateQueries();
      lastEventIdRef.current = '';
      const evt = new CustomEvent('realtime-hard-reset', { detail: { reason: 'long_offline' } });
      window.dispatchEvent(evt);
    } catch {}
  };

  const openCircuit = () => {
    circuitOpenRef.current = true;
    // Inform UI (optional banner listeners)
    try { window.dispatchEvent(new CustomEvent('realtime-circuit-open')); } catch {}
    // Schedule half-open after 30s
    setTimeout(() => { circuitOpenRef.current = false; consecutiveFailuresRef.current = 0; }, 30000);
  };

  // Main subscribe loop
  const subscribe = async () => {
    if (!orgId || !tokenHash) return;
    if (circuitOpenRef.current) return;
    if (suspendedRef.current) { scheduleNext(1000, 1500); return; }
    if (inFlightRef.current) return;

    // Degraded mode: Safari private → visible-only polling with longer backoff
    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      scheduleNext(5000, 10000);
      return;
    }

    // Followers: monitor leader, do not poll unless takeover
    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      if (leaseKey) {
        try {
          const raw = localStorage.getItem(leaseKey);
          const data = raw ? JSON.parse(raw) : null;
          const expired = !data || data.exp < now();
          const stale = now() - lastLeaderHeartbeatRef.current > 3000;
          if (expired || stale) {
            tryBecomeLeader();
          }
        } catch {
          tryBecomeLeader();
        }
      }
      scheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { scheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      inFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/finance/realtime/subscribe`);
      if (lastEventIdRef.current) url.searchParams.set('lastEventId', lastEventIdRef.current);

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        backoffMsRef.current = 5000;
        consecutiveFailuresRef.current++;
        try { window.dispatchEvent(new CustomEvent('realtime-auth-error', { detail: { status: resp.status } })); } catch {}
        if (consecutiveFailuresRef.current >= 3) openCircuit();
        return;
      }

      if (!resp.ok) throw new Error(`subscribe failed ${resp.status}`);

      const data = await resp.json();
      consecutiveFailuresRef.current = 0;
      circuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (dispatchEnabled) {
            window.dispatchEvent(new CustomEvent('finance-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            // Shadow mode: don't deliver to app, but emit a shadow hook for debugging/metrics
            window.dispatchEvent(new CustomEvent('finance-shadow-events', { detail: { events: filtered } }));
          }
          if (eventsChannelRef.current && isLeaderRef.current) {
            try { eventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) lastEventIdRef.current = lastId;
          lastSuccessAtRef.current = now();
          emitHealth(true);
          backoffMsRef.current = 500;
        } catch {
          // No-op
        }
      } else {
        // heartbeat success
        lastSuccessAtRef.current = now();
        emitHealth(true);
        const elapsed = now() - started;
        backoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      // Leadership upkeep
      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }

      // Long offline recovery (>60s)
      const last = lastSuccessAtRef.current;
      if (!circuitOpenRef.current && last && now() - last > 60000) {
        hardRecover();
      }
    } catch {
      consecutiveFailuresRef.current++;
      emitHealth(false);
      backoffMsRef.current = Math.min((backoffMsRef.current || 1000) * 2, 5000);
      if (consecutiveFailuresRef.current >= 3) {
        openCircuit();
      }
    } finally {
      inFlightRef.current = false;
      scheduleNext(backoffMsRef.current, backoffMsRef.current + 250);
    }
  };

  // Global suspend/resume controls to free browser connections during heavy operations (e.g., document viewing)
  useEffect(() => {
    const onSuspend = () => {
      try {
        suspendedRef.current = true;
        // Abort any in-flight request and clear timers
        abortRef.current?.abort();
        inFlightRef.current = false;
        if (nextTimerRef.current) {
          clearTimeout(nextTimerRef.current);
          nextTimerRef.current = null;
        }
      } catch {}
    };
    const onResume = () => {
      if (!suspendedRef.current) return;
      suspendedRef.current = false;
      if (!inFlightRef.current && !circuitOpenRef.current) {
        try { if (nextTimerRef.current) clearTimeout(nextTimerRef.current); } catch {}
        nextTimerRef.current = setTimeout(subscribe, 0);
      }
    };
    window.addEventListener('realtime:suspend', onSuspend);
    window.addEventListener('realtime:resume', onResume);
    return () => {
      window.removeEventListener('realtime:suspend', onSuspend);
      window.removeEventListener('realtime:resume', onResume);
    };
  }, []);

  const scheduleNext = (minMs: number, maxMs: number) => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(subscribe, jitter(minMs, maxMs));
  };

  // ================= Guest service flags and state =================
  const guestMasterEnabled = getFlagBool('GUEST_REALTIME_V1', false);
  const guestRolloutPercent = getFlagNumber('GUEST_REALTIME_ROLLOUT_PERCENT', 0);
  const isGuestOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('GUEST_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInGuestRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, guestRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 11003 + 71807) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const guestEnabledForOrg = guestMasterEnabled && !isGuestOrgDisabled(orgId) && isInGuestRollout(orgId);
  const guestDispatchEnabled = guestEnabledForOrg && !shadowMode;

  const guestLastEventIdRef = useRef<string>('');
  const guestInFlightRef = useRef<boolean>(false);
  const guestBackoffMsRef = useRef<number>(1500);
  const guestConsecutiveFailuresRef = useRef<number>(0);
  const guestCircuitOpenRef = useRef<boolean>(false);
  const guestNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestAbortRef = useRef<AbortController | null>(null);

  const guestScheduleNext = (minMs: number, maxMs: number) => {
    if (guestNextTimerRef.current) clearTimeout(guestNextTimerRef.current);
    guestNextTimerRef.current = setTimeout(subscribeGuest, jitter(minMs, maxMs));
  };

  const subscribeGuest = async () => {
    if (!orgId || !tokenHash) return;
    if (!guestEnabledForOrg && !shadowMode) return;
    if (guestCircuitOpenRef.current) return;
    if (guestInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      guestScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      guestScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { guestScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    guestAbortRef.current = controller;

    try {
      guestInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/guest-checkin/realtime/subscribe-v3`);
      if (guestLastEventIdRef.current) url.searchParams.set('lastEventId', guestLastEventIdRef.current);
      try {
        const pid = (window as any)?.__guestSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        guestBackoffMsRef.current = 5000;
        guestConsecutiveFailuresRef.current++;
        if (guestConsecutiveFailuresRef.current >= 3) guestCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`guest subscribe failed ${resp.status}`);

      const data = await resp.json();
      guestConsecutiveFailuresRef.current = 0;
      guestCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (guestDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('guest-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('guest-shadow-events', { detail: { events: filtered } }));
          }
          if (guestEventsChannelRef.current && isLeaderRef.current) {
            try { guestEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) guestLastEventIdRef.current = lastId;
          guestLastSuccessAtRef.current = Date.now();
          emitGuestHealth(true);
          guestBackoffMsRef.current = 800;
        } catch {}
      } else {
        guestLastSuccessAtRef.current = Date.now();
        emitGuestHealth(true);
        const elapsed = now() - started;
        guestBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      guestConsecutiveFailuresRef.current++;
      emitGuestHealth(false);
      guestBackoffMsRef.current = Math.min((guestBackoffMsRef.current || 1000) * 2, 5000);
      if (guestConsecutiveFailuresRef.current >= 3) {
        guestCircuitOpenRef.current = true;
      }
    } finally {
      guestInFlightRef.current = false;
      guestScheduleNext(guestBackoffMsRef.current, guestBackoffMsRef.current + 250);
    }
  };

  // ================= Staff service flags and state =================
  const staffMasterEnabled = getFlagBool('STAFF_REALTIME_V1', true);
  const staffRolloutPercent = getFlagNumber('STAFF_REALTIME_ROLLOUT_PERCENT', 100);
  const isStaffOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('STAFF_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInStaffRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, staffRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 13007 + 51769) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const staffEnabledForOrg = staffMasterEnabled && !isStaffOrgDisabled(orgId) && isInStaffRollout(orgId);
  const staffDispatchEnabled = staffEnabledForOrg && !shadowMode;

  const staffLastEventIdRef = useRef<string>('');
  const staffInFlightRef = useRef<boolean>(false);
  const staffBackoffMsRef = useRef<number>(1500);
  const staffConsecutiveFailuresRef = useRef<number>(0);
  const staffCircuitOpenRef = useRef<boolean>(false);
  const staffNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffAbortRef = useRef<AbortController | null>(null);

  const staffScheduleNext = (minMs: number, maxMs: number) => {
    if (staffNextTimerRef.current) clearTimeout(staffNextTimerRef.current);
    staffNextTimerRef.current = setTimeout(subscribeStaff, jitter(minMs, maxMs));
  };

  const subscribeStaff = async () => {
    if (!orgId || !tokenHash) return;
    if (!staffEnabledForOrg && !shadowMode) return;
    if (staffCircuitOpenRef.current) return;
    if (staffInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      staffScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      staffScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { staffScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    staffAbortRef.current = controller;

    try {
      staffInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/staff/realtime/subscribe`);
      if (staffLastEventIdRef.current) url.searchParams.set('lastEventId', staffLastEventIdRef.current);
      try {
        const pid = (window as any)?.__staffSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        staffBackoffMsRef.current = 5000;
        staffConsecutiveFailuresRef.current++;
        if (staffConsecutiveFailuresRef.current >= 3) staffCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`staff subscribe failed ${resp.status}`);

      const data = await resp.json();
      staffConsecutiveFailuresRef.current = 0;
      staffCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (staffDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('staff-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('staff-shadow-events', { detail: { events: filtered } }));
          }
          if (staffEventsChannelRef.current && isLeaderRef.current) {
            try { staffEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) staffLastEventIdRef.current = lastId;
          staffLastSuccessAtRef.current = Date.now();
          emitStaffHealth(true);
          staffBackoffMsRef.current = 800;
        } catch {}
      } else {
        staffLastSuccessAtRef.current = Date.now();
        emitStaffHealth(true);
        const elapsed = now() - started;
        staffBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      staffConsecutiveFailuresRef.current++;
      emitStaffHealth(false);
      staffBackoffMsRef.current = Math.min((staffBackoffMsRef.current || 1000) * 2, 5000);
      if (staffConsecutiveFailuresRef.current >= 3) {
        staffCircuitOpenRef.current = true;
      }
    } finally {
      staffInFlightRef.current = false;
      staffScheduleNext(staffBackoffMsRef.current, staffBackoffMsRef.current + 250);
    }
  };

  // ================= Users service flags and state =================
  const usersMasterEnabled = getFlagBool('USERS_REALTIME_V1', true);
  const usersRolloutPercent = getFlagNumber('USERS_REALTIME_ROLLOUT_PERCENT', 100);
  const isUsersOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('USERS_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInUsersRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, usersRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 17033 + 33013) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const usersEnabledForOrg = usersMasterEnabled && !isUsersOrgDisabled(orgId) && isInUsersRollout(orgId);
  const usersDispatchEnabled = usersEnabledForOrg && !shadowMode;

  const usersLastEventIdRef = useRef<string>('');
  const usersInFlightRef = useRef<boolean>(false);
  const usersBackoffMsRef = useRef<number>(1500);
  const usersConsecutiveFailuresRef = useRef<number>(0);
  const usersCircuitOpenRef = useRef<boolean>(false);
  const usersNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersAbortRef = useRef<AbortController | null>(null);

  const usersScheduleNext = (minMs: number, maxMs: number) => {
    if (usersNextTimerRef.current) clearTimeout(usersNextTimerRef.current);
    usersNextTimerRef.current = setTimeout(subscribeUsers, jitter(minMs, maxMs));
  };

  const subscribeUsers = async () => {
    if (!orgId || !tokenHash) return;
    if (!usersEnabledForOrg && !shadowMode) return;
    if (usersCircuitOpenRef.current) return;
    if (usersInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      usersScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      usersScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { usersScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    usersAbortRef.current = controller;

    try {
      usersInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/users/realtime/subscribe`);
      if (usersLastEventIdRef.current) url.searchParams.set('lastEventId', usersLastEventIdRef.current);

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        usersBackoffMsRef.current = 5000;
        usersConsecutiveFailuresRef.current++;
        if (usersConsecutiveFailuresRef.current >= 3) usersCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`users subscribe failed ${resp.status}`);

      const data = await resp.json();
      usersConsecutiveFailuresRef.current = 0;
      usersCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (usersDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('users-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('users-shadow-events', { detail: { events: filtered } }));
          }
          if (usersEventsChannelRef.current && isLeaderRef.current) {
            try { usersEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) usersLastEventIdRef.current = lastId;
          usersLastSuccessAtRef.current = Date.now();
          emitUsersHealth(true);
          usersBackoffMsRef.current = 800;
        } catch {}
      } else {
        usersLastSuccessAtRef.current = Date.now();
        emitUsersHealth(true);
        const elapsed = now() - started;
        usersBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      usersConsecutiveFailuresRef.current++;
      emitUsersHealth(false);
      usersBackoffMsRef.current = Math.min((usersBackoffMsRef.current || 1000) * 2, 5000);
      if (usersConsecutiveFailuresRef.current >= 3) {
        usersCircuitOpenRef.current = true;
      }
    } finally {
      usersInFlightRef.current = false;
      usersScheduleNext(usersBackoffMsRef.current, usersBackoffMsRef.current + 250);
    }
  };

  // ================= Properties service flags and state =================
  const propertiesMasterEnabled = getFlagBool('PROPERTIES_REALTIME_V1', true);
  const propertiesRolloutPercent = getFlagNumber('PROPERTIES_REALTIME_ROLLOUT_PERCENT', 100);
  const isPropertiesOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('PROPERTIES_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInPropertiesRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, propertiesRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 15061 + 28229) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const propertiesEnabledForOrg = propertiesMasterEnabled && !isPropertiesOrgDisabled(orgId) && isInPropertiesRollout(orgId);
  const propertiesDispatchEnabled = propertiesEnabledForOrg && !shadowMode;

  const propertiesLastEventIdRef = useRef<string>('');
  const propertiesInFlightRef = useRef<boolean>(false);
  const propertiesBackoffMsRef = useRef<number>(1500);
  const propertiesConsecutiveFailuresRef = useRef<number>(0);
  const propertiesCircuitOpenRef = useRef<boolean>(false);
  const propertiesNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertiesAbortRef = useRef<AbortController | null>(null);

  const propertiesScheduleNext = (minMs: number, maxMs: number) => {
    if (propertiesNextTimerRef.current) clearTimeout(propertiesNextTimerRef.current);
    propertiesNextTimerRef.current = setTimeout(subscribeProperties, jitter(minMs, maxMs));
  };

  const subscribeProperties = async () => {
    if (!orgId || !tokenHash) return;
    if (!propertiesEnabledForOrg && !shadowMode) return;
    if (propertiesCircuitOpenRef.current) return;
    if (propertiesInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      propertiesScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      propertiesScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { propertiesScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    propertiesAbortRef.current = controller;

    try {
      propertiesInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/properties/realtime/subscribe`);
      if (propertiesLastEventIdRef.current) url.searchParams.set('lastEventId', propertiesLastEventIdRef.current);
      try {
        const pid = (window as any)?.__propertiesSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        propertiesBackoffMsRef.current = 5000;
        propertiesConsecutiveFailuresRef.current++;
        if (propertiesConsecutiveFailuresRef.current >= 3) propertiesCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`properties subscribe failed ${resp.status}`);

      const data = await resp.json();
      propertiesConsecutiveFailuresRef.current = 0;
      propertiesCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (propertiesDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('properties-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('properties-shadow-events', { detail: { events: filtered } }));
          }
          if (propertiesEventsChannelRef.current && isLeaderRef.current) {
            try { propertiesEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) propertiesLastEventIdRef.current = lastId;
          propertiesLastSuccessAtRef.current = Date.now();
          emitPropertiesHealth(true);
          propertiesBackoffMsRef.current = 800;
        } catch {}
      } else {
        propertiesLastSuccessAtRef.current = Date.now();
        emitPropertiesHealth(true);
        const elapsed = now() - started;
        propertiesBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      propertiesConsecutiveFailuresRef.current++;
      emitPropertiesHealth(false);
      propertiesBackoffMsRef.current = Math.min((propertiesBackoffMsRef.current || 1000) * 2, 5000);
      if (propertiesConsecutiveFailuresRef.current >= 3) {
        propertiesCircuitOpenRef.current = true;
      }
    } finally {
      propertiesInFlightRef.current = false;
      propertiesScheduleNext(propertiesBackoffMsRef.current, propertiesBackoffMsRef.current + 250);
    }
  };

  // ================= Tasks service flags and state =================
  const tasksMasterEnabled = getFlagBool('TASKS_REALTIME_V1', true);
  const tasksRolloutPercent = getFlagNumber('TASKS_REALTIME_ROLLOUT_PERCENT', 100);
  const isTasksOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('TASKS_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInTasksRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, tasksRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 19211 + 44017) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const tasksEnabledForOrg = tasksMasterEnabled && !isTasksOrgDisabled(orgId) && isInTasksRollout(orgId);
  const tasksDispatchEnabled = tasksEnabledForOrg && !shadowMode;

  const tasksLastEventIdRef = useRef<string>('');
  const tasksInFlightRef = useRef<boolean>(false);
  const tasksBackoffMsRef = useRef<number>(1500);
  const tasksConsecutiveFailuresRef = useRef<number>(0);
  const tasksCircuitOpenRef = useRef<boolean>(false);
  const tasksNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksAbortRef = useRef<AbortController | null>(null);

  const tasksScheduleNext = (minMs: number, maxMs: number) => {
    if (tasksNextTimerRef.current) clearTimeout(tasksNextTimerRef.current);
    tasksNextTimerRef.current = setTimeout(subscribeTasks, jitter(minMs, maxMs));
  };

  const subscribeTasks = async () => {
    if (!orgId || !tokenHash) return;
    if (!tasksEnabledForOrg && !shadowMode) return;
    if (tasksCircuitOpenRef.current) return;
    if (tasksInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      tasksScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      tasksScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { tasksScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    tasksAbortRef.current = controller;

    try {
      tasksInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/tasks/realtime/subscribe`);
      if (tasksLastEventIdRef.current) url.searchParams.set('lastEventId', tasksLastEventIdRef.current);
      try {
        const pid = (window as any)?.__tasksSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        tasksBackoffMsRef.current = 5000;
        tasksConsecutiveFailuresRef.current++;
        if (tasksConsecutiveFailuresRef.current >= 3) tasksCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`tasks subscribe failed ${resp.status}`);

      const data = await resp.json();
      tasksConsecutiveFailuresRef.current = 0;
      tasksCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (tasksDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('tasks-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('tasks-shadow-events', { detail: { events: filtered } }));
          }
          if (tasksEventsChannelRef.current && isLeaderRef.current) {
            try { tasksEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) tasksLastEventIdRef.current = lastId;
          tasksLastSuccessAtRef.current = Date.now();
          emitTasksHealth(true);
          tasksBackoffMsRef.current = 800;
        } catch {}
      } else {
        tasksLastSuccessAtRef.current = Date.now();
        emitTasksHealth(true);
        const elapsed = now() - started;
        tasksBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      tasksConsecutiveFailuresRef.current++;
      emitTasksHealth(false);
      tasksBackoffMsRef.current = Math.min((tasksBackoffMsRef.current || 1000) * 2, 5000);
      if (tasksConsecutiveFailuresRef.current >= 3) {
        tasksCircuitOpenRef.current = true;
      }
    } finally {
      tasksInFlightRef.current = false;
      tasksScheduleNext(tasksBackoffMsRef.current, tasksBackoffMsRef.current + 250);
    }
  };

  // ================= Dashboard service flags and state =================
  const dashboardMasterEnabled = getFlagBool('DASHBOARD_REALTIME_V1', true);
  const dashboardRolloutPercent = getFlagNumber('DASHBOARD_REALTIME_ROLLOUT_PERCENT', 100);
  const isDashboardOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('DASHBOARD_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInDashboardRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, dashboardRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 19211 + 44017) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const dashboardEnabledForOrg = dashboardMasterEnabled && !isDashboardOrgDisabled(orgId) && isInDashboardRollout(orgId);
  const dashboardDispatchEnabled = dashboardEnabledForOrg && !shadowMode;

  const dashboardLastEventIdRef = useRef<string>('');
  const dashboardInFlightRef = useRef<boolean>(false);
  const dashboardBackoffMsRef = useRef<number>(1500);
  const dashboardConsecutiveFailuresRef = useRef<number>(0);
  const dashboardCircuitOpenRef = useRef<boolean>(false);
  const dashboardNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardAbortRef = useRef<AbortController | null>(null);

  const dashboardScheduleNext = (minMs: number, maxMs: number) => {
    if (dashboardNextTimerRef.current) clearTimeout(dashboardNextTimerRef.current);
    dashboardNextTimerRef.current = setTimeout(subscribeDashboard, jitter(minMs, maxMs));
  };

  const subscribeDashboard = async () => {
    if (!orgId || !tokenHash) return;
    if (!dashboardEnabledForOrg && !shadowMode) return;
    if (dashboardCircuitOpenRef.current) return;
    if (dashboardInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      dashboardScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      dashboardScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { dashboardScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    dashboardAbortRef.current = controller;

    try {
      dashboardInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/dashboard/realtime/subscribe`);
      if (dashboardLastEventIdRef.current) url.searchParams.set('lastEventId', dashboardLastEventIdRef.current);
      try {
        const pid = (window as any)?.__dashboardSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        dashboardBackoffMsRef.current = 5000;
        dashboardConsecutiveFailuresRef.current++;
        if (dashboardConsecutiveFailuresRef.current >= 3) dashboardCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`dashboard subscribe failed ${resp.status}`);

      const data = await resp.json();
      dashboardConsecutiveFailuresRef.current = 0;
      dashboardCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (dashboardDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('dashboard-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('dashboard-shadow-events', { detail: { events: filtered } }));
          }
          if (dashboardEventsChannelRef.current && isLeaderRef.current) {
            try { dashboardEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) dashboardLastEventIdRef.current = lastId;
          dashboardLastSuccessAtRef.current = Date.now();
          emitDashboardHealth(true);
          dashboardBackoffMsRef.current = 800;
        } catch {}
      } else {
        dashboardLastSuccessAtRef.current = Date.now();
        emitDashboardHealth(true);
        const elapsed = now() - started;
        dashboardBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      dashboardConsecutiveFailuresRef.current++;
      emitDashboardHealth(false);
      dashboardBackoffMsRef.current = Math.min((dashboardBackoffMsRef.current || 1000) * 2, 5000);
      if (dashboardConsecutiveFailuresRef.current >= 3) {
        dashboardCircuitOpenRef.current = true;
      }
    } finally {
      dashboardInFlightRef.current = false;
      dashboardScheduleNext(dashboardBackoffMsRef.current, dashboardBackoffMsRef.current + 250);
    }
  };

  // ================= Branding (Settings) service flags and state =================
  const brandingMasterEnabled = getFlagBool('BRANDING_REALTIME_V1', true);
  const brandingRolloutPercent = getFlagNumber('BRANDING_REALTIME_ROLLOUT_PERCENT', 100);
  const isBrandingOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('BRANDING_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInBrandingRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, brandingRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 19211 + 44017) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const brandingEnabledForOrg = brandingMasterEnabled && !isBrandingOrgDisabled(orgId) && isInBrandingRollout(orgId);
  const brandingDispatchEnabled = brandingEnabledForOrg && !shadowMode;

  const brandingLastEventIdRef = useRef<string>('');
  const brandingInFlightRef = useRef<boolean>(false);
  const brandingBackoffMsRef = useRef<number>(1500);
  const brandingConsecutiveFailuresRef = useRef<number>(0);
  const brandingCircuitOpenRef = useRef<boolean>(false);
  const brandingNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingAbortRef = useRef<AbortController | null>(null);

  const brandingScheduleNext = (minMs: number, maxMs: number) => {
    if (brandingNextTimerRef.current) clearTimeout(brandingNextTimerRef.current);
    brandingNextTimerRef.current = setTimeout(subscribeBranding, jitter(minMs, maxMs));
  };

  const subscribeBranding = async () => {
    if (!orgId || !tokenHash) return;
    if (!brandingEnabledForOrg && !shadowMode) return;
    if (brandingCircuitOpenRef.current) return;
    if (brandingInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      brandingScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      brandingScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { brandingScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    brandingAbortRef.current = controller;

    try {
      brandingInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/branding/realtime/subscribe`);
      if (brandingLastEventIdRef.current) url.searchParams.set('lastEventId', brandingLastEventIdRef.current);

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        brandingBackoffMsRef.current = 5000;
        brandingConsecutiveFailuresRef.current++;
        if (brandingConsecutiveFailuresRef.current >= 3) brandingCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`branding subscribe failed ${resp.status}`);

      const data = await resp.json();
      brandingConsecutiveFailuresRef.current = 0;
      brandingCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (brandingDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('branding-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('branding-shadow-events', { detail: { events: filtered } }));
          }
          if (brandingEventsChannelRef.current && isLeaderRef.current) {
            try { brandingEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) brandingLastEventIdRef.current = lastId;
          brandingLastSuccessAtRef.current = Date.now();
          emitBrandingHealth(true);
          brandingBackoffMsRef.current = 800;
        } catch {}
      } else {
        brandingLastSuccessAtRef.current = Date.now();
        emitBrandingHealth(true);
        const elapsed = now() - started;
        brandingBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      brandingConsecutiveFailuresRef.current++;
      emitBrandingHealth(false);
      brandingBackoffMsRef.current = Math.min((brandingBackoffMsRef.current || 1000) * 2, 5000);
      if (brandingConsecutiveFailuresRef.current >= 3) {
        brandingCircuitOpenRef.current = true;
      }
    } finally {
      brandingInFlightRef.current = false;
      brandingScheduleNext(brandingBackoffMsRef.current, brandingBackoffMsRef.current + 250);
    }
  };

  // ================= Analytics service flags and state =================
  const analyticsMasterEnabled = getFlagBool('ANALYTICS_REALTIME_V1', true);
  const analyticsRolloutPercent = getFlagNumber('ANALYTICS_REALTIME_ROLLOUT_PERCENT', 100);
  const isAnalyticsOrgDisabled = (oid: number | null): boolean => {
    try {
      const raw = localStorage.getItem('ANALYTICS_REALTIME_DISABLED_ORGS') || '';
      if (!raw) return false;
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      return oid != null && ids.includes(String(oid));
    } catch {
      return false;
    }
  };
  const isInAnalyticsRollout = (oid: number | null): boolean => {
    if (oid == null) return true;
    const percent = Math.max(0, Math.min(100, analyticsRolloutPercent));
    if (percent >= 100) return true;
    const bucket = (oid * 19211 + 44017) % 233280;
    const normalized = (bucket / 233280) * 100;
    return normalized < percent;
  };
  const analyticsEnabledForOrg = analyticsMasterEnabled && !isAnalyticsOrgDisabled(orgId) && isInAnalyticsRollout(orgId);
  const analyticsDispatchEnabled = analyticsEnabledForOrg && !shadowMode;

  const analyticsLastEventIdRef = useRef<string>('');
  const analyticsInFlightRef = useRef<boolean>(false);
  const analyticsBackoffMsRef = useRef<number>(1500);
  const analyticsConsecutiveFailuresRef = useRef<number>(0);
  const analyticsCircuitOpenRef = useRef<boolean>(false);
  const analyticsNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyticsAbortRef = useRef<AbortController | null>(null);

  const analyticsScheduleNext = (minMs: number, maxMs: number) => {
    if (analyticsNextTimerRef.current) clearTimeout(analyticsNextTimerRef.current);
    analyticsNextTimerRef.current = setTimeout(subscribeAnalytics, jitter(minMs, maxMs));
  };

  const subscribeAnalytics = async () => {
    if (!orgId || !tokenHash) return;
    if (!analyticsEnabledForOrg && !shadowMode) return;
    if (analyticsCircuitOpenRef.current) return;
    if (analyticsInFlightRef.current) return;

    if (degradedModeRef.current && document.visibilityState !== 'visible') {
      analyticsScheduleNext(5000, 10000);
      return;
    }

    if (leaderEnabled && !isLeaderRef.current && !degradedModeRef.current) {
      analyticsScheduleNext(3000, 5000);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) { analyticsScheduleNext(2000, 4000); return; }

    const controller = new AbortController();
    analyticsAbortRef.current = controller;

    try {
      analyticsInFlightRef.current = true;
      const url = new URL(`${API_CONFIG.BASE_URL}/v1/analytics/realtime/subscribe`);
      if (analyticsLastEventIdRef.current) url.searchParams.set('lastEventId', analyticsLastEventIdRef.current);
      try {
        const pid = (window as any)?.__analyticsSelectedPropertyId;
        if (pid && pid !== 'all') url.searchParams.set('propertyId', String(pid));
      } catch {}

      const started = now();
      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        analyticsBackoffMsRef.current = 5000;
        analyticsConsecutiveFailuresRef.current++;
        if (analyticsConsecutiveFailuresRef.current >= 3) analyticsCircuitOpenRef.current = true;
        return;
      }
      if (!resp.ok) throw new Error(`analytics subscribe failed ${resp.status}`);

      const data = await resp.json();
      analyticsConsecutiveFailuresRef.current = 0;
      analyticsCircuitOpenRef.current = false;

      const events = Array.isArray(data?.events) ? data.events : [];
      const filtered = dedupFilter(orgId!, sortEvents(events));

      if (filtered.length > 0) {
        try {
          if (analyticsDispatchEnabled) {
            window.dispatchEvent(new CustomEvent('analytics-stream-events', { detail: { events: filtered } }));
          } else if (shadowMode) {
            window.dispatchEvent(new CustomEvent('analytics-shadow-events', { detail: { events: filtered } }));
          }
          if (analyticsEventsChannelRef.current && isLeaderRef.current) {
            try { analyticsEventsChannelRef.current.postMessage({ events: filtered }); } catch {}
          }
          const lastId = data.lastEventId || filtered[filtered.length - 1]?.timestamp || '';
          if (lastId) analyticsLastEventIdRef.current = lastId;
          analyticsLastSuccessAtRef.current = Date.now();
          emitAnalyticsHealth(true);
          analyticsBackoffMsRef.current = 800;
        } catch {}
      } else {
        analyticsLastSuccessAtRef.current = Date.now();
        emitAnalyticsHealth(true);
        const elapsed = now() - started;
        analyticsBackoffMsRef.current = elapsed < 1500 ? jitter(2000, 5000) : 1200;
      }

      if (leaderEnabled && isLeaderRef.current) {
        renewLease();
        sendHeartbeat();
      }
    } catch {
      analyticsConsecutiveFailuresRef.current++;
      emitAnalyticsHealth(false);
      analyticsBackoffMsRef.current = Math.min((analyticsBackoffMsRef.current || 1000) * 2, 5000);
      if (analyticsConsecutiveFailuresRef.current >= 3) {
        analyticsCircuitOpenRef.current = true;
      }
    } finally {
      analyticsInFlightRef.current = false;
      analyticsScheduleNext(analyticsBackoffMsRef.current, analyticsBackoffMsRef.current + 250);
    }
  };
  // Periodic reconciliation (aggregates only)
  const reconcileAggregates = () => {
    if (!isLeaderRef.current) return;
    if (document.visibilityState !== 'visible') return;
    // Debounce window configurable
    const debounceMs = Math.max(50, getFlagNumber('FIN_AGG_RECON_DEBOUNCE_MS', 1000));
    // Use a single timer stored on window to avoid multiple providers (defensive)
    const k = '__fin_recon_timer__';
    const anyWin = window as any;
    if (anyWin[k]) return;
    anyWin[k] = setTimeout(() => {
      try {
        queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
        queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
        queryClient.invalidateQueries({ queryKey: ['today-pending-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      } finally {
        clearTimeout(anyWin[k]);
        anyWin[k] = null;
      }
    }, debounceMs);
  };

  // Init
  useEffect(() => {
    // Respect feature flags and rollout; allow shadow mode to run transport even if master flag is off
    if (!runTransport || !orgId || !tokenHash) {
      return;
    }

    // Detect degraded mode (Safari private)
    try {
      localStorage.setItem('__rt_test__', '1');
      localStorage.removeItem('__rt_test__');
    } catch { degradedModeRef.current = true; }
    try {
      const ch = new BroadcastChannel('__rt_test__'); ch.close();
    } catch { degradedModeRef.current = true; }

    // Setup channels
    if (leaderEnabled && tokenHash && orgId != null && typeof window !== 'undefined' && 'BroadcastChannel' in window && !degradedModeRef.current) {
      if (leaderChannelName) {
        leaderChannelRef.current = new BroadcastChannel(leaderChannelName);
        leaderChannelRef.current.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.t === 'hb') {
            lastLeaderHeartbeatRef.current = now();
            // If seq higher than ours and we think we are leader → yield
            if (isLeaderRef.current && typeof msg.seq === 'number') {
              // Another tab believes it's leader; yield to higher sequence
              if (msg.seq > leaderSeqRef.current) {
                isLeaderRef.current = false;
              }
            }
          } else if (msg.t === 'resign' && msg.tabId !== tabIdRef.current) {
            // Immediate takeover attempt
            setTimeout(tryBecomeLeader, Math.floor(Math.random() * 300));
          }
        };
      }
      if (eventsChannelName) {
        eventsChannelRef.current = new BroadcastChannel(eventsChannelName);
        eventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (dispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('finance-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('finance-shadow-events', { detail: { events: filtered } }));
                }
                lastSuccessAtRef.current = now();
                emitHealth(true);
              } catch {}
            }
          }
        };
      }
      if (guestEventsChannelName) {
        guestEventsChannelRef.current = new BroadcastChannel(guestEventsChannelName);
        guestEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (guestDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('guest-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('guest-shadow-events', { detail: { events: filtered } }));
                }
                guestLastSuccessAtRef.current = now();
                emitGuestHealth(true);
              } catch {}
            }
          }
        };
      }
      if (staffEventsChannelName) {
        staffEventsChannelRef.current = new BroadcastChannel(staffEventsChannelName);
        staffEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (staffDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('staff-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('staff-shadow-events', { detail: { events: filtered } }));
                }
                staffLastSuccessAtRef.current = now();
                emitStaffHealth(true);
              } catch {}
            }
          }
        };
      }
      if (usersEventsChannelName) {
        usersEventsChannelRef.current = new BroadcastChannel(usersEventsChannelName);
        usersEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (usersDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('users-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('users-shadow-events', { detail: { events: filtered } }));
                }
                usersLastSuccessAtRef.current = now();
                emitUsersHealth(true);
              } catch {}
            }
          }
        };
      }
      if (propertiesEventsChannelName) {
        propertiesEventsChannelRef.current = new BroadcastChannel(propertiesEventsChannelName);
        propertiesEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (propertiesDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('properties-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('properties-shadow-events', { detail: { events: filtered } }));
                }
                propertiesLastSuccessAtRef.current = now();
                emitPropertiesHealth(true);
              } catch {}
            }
          }
        };
      }
      if (tasksEventsChannelName) {
        tasksEventsChannelRef.current = new BroadcastChannel(tasksEventsChannelName);
        tasksEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (tasksDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('tasks-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('tasks-shadow-events', { detail: { events: filtered } }));
                }
                tasksLastSuccessAtRef.current = now();
                emitTasksHealth(true);
              } catch {}
            }
          }
        };
      }
      if (dashboardEventsChannelName) {
        dashboardEventsChannelRef.current = new BroadcastChannel(dashboardEventsChannelName);
        dashboardEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (dashboardDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('dashboard-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('dashboard-shadow-events', { detail: { events: filtered } }));
                }
                dashboardLastSuccessAtRef.current = now();
                emitDashboardHealth(true);
              } catch {}
            }
          }
        };
      }
      if (brandingEventsChannelName) {
        brandingEventsChannelRef.current = new BroadcastChannel(brandingEventsChannelName);
        brandingEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (brandingDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('branding-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('branding-shadow-events', { detail: { events: filtered } }));
                }
                brandingLastSuccessAtRef.current = now();
                emitBrandingHealth(true);
              } catch {}
            }
          }
        };
      }
      if (analyticsEventsChannelName) {
        analyticsEventsChannelRef.current = new BroadcastChannel(analyticsEventsChannelName);
        analyticsEventsChannelRef.current.onmessage = (ev) => {
          const data = ev.data;
          if (Array.isArray(data?.events)) {
            const filtered = dedupFilter(orgId!, sortEvents(data.events));
            if (filtered.length > 0) {
              try {
                if (analyticsDispatchEnabled) {
                  window.dispatchEvent(new CustomEvent('analytics-stream-events', { detail: { events: filtered } }));
                } else if (shadowMode) {
                  window.dispatchEvent(new CustomEvent('analytics-shadow-events', { detail: { events: filtered } }));
                }
                analyticsLastSuccessAtRef.current = now();
                emitAnalyticsHealth(true);
              } catch {}
            }
          }
        };
      }
      // Initial leader attempt
      tryBecomeLeader();
    } else {
      // Single-tab fallback
      isLeaderRef.current = true;
    }

    // Visibility listener
    document.addEventListener('visibilitychange', onVisibility);

    // Kick off subscribe loop
    subscribe();
    // Staggered start for guest service
    if (guestMasterEnabled || shadowMode) {
      setTimeout(() => subscribeGuest(), 5000);
    }
    // Staggered start for staff service (+5s from finance)
    if (staffMasterEnabled || shadowMode) {
      setTimeout(() => subscribeStaff(), 5000);
    }
    // Staggered start for users service (+5s from finance)
    if (usersMasterEnabled || shadowMode) {
      setTimeout(() => subscribeUsers(), 5000);
    }
    // Staggered start for properties service (+5s from finance)
    if (propertiesMasterEnabled || shadowMode) {
      setTimeout(() => subscribeProperties(), 5000);
    }
    // Staggered start for tasks service (+5s from finance)
    if (tasksMasterEnabled || shadowMode) {
      setTimeout(() => subscribeTasks(), 5000);
    }
    if (dashboardMasterEnabled || shadowMode) {
      setTimeout(() => subscribeDashboard(), 5000);
    }
    if (brandingMasterEnabled || shadowMode) {
      setTimeout(() => subscribeBranding(), 5000);
    }
    if (analyticsMasterEnabled || shadowMode) {
      setTimeout(() => subscribeAnalytics(), 5000);
    }

    // Reconciliation timer
    const reconTimer = setInterval(reconcileAggregates, 60000);
    // Continuous offline monitoring (every 10s)
    const offlineCheckTimer = setInterval(() => {
      const last = lastSuccessAtRef.current;
      if (!circuitOpenRef.current && last && now() - last > 60000) {
        hardRecover();
      }
    }, 10000);

    // SLI reporting (every 5 minutes) - lightweight placeholder
    const sliTimer = setInterval(() => {
      if (envUtils.isProduction() || Math.random() >= TELEMETRY_SAMPLE) return;
      try {
        fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sampleRate: TELEMETRY_SAMPLE,
            events: [{
              type: 'realtime_sli',
              orgId,
              ts: new Date().toISOString(),
              isLeader: isLeaderRef.current,
              circuitOpen: circuitOpenRef.current,
              lastSuccessAt: lastSuccessAtRef.current || null,
            }],
          }),
        }).catch(() => {});
      } catch {}
    }, 5 * 60 * 1000);

    return () => {
      // Resign best-effort
      if (isLeaderRef.current) resignLeadership();
      abortRef.current?.abort();
      guestAbortRef.current?.abort();
      staffAbortRef.current?.abort();
      usersAbortRef.current?.abort();
      propertiesAbortRef.current?.abort();
      tasksAbortRef.current?.abort();
      dashboardAbortRef.current?.abort();
      brandingAbortRef.current?.abort();
      if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
      if (guestNextTimerRef.current) { clearTimeout(guestNextTimerRef.current); guestNextTimerRef.current = null; }
      if (staffNextTimerRef.current) { clearTimeout(staffNextTimerRef.current); staffNextTimerRef.current = null; }
      if (usersNextTimerRef.current) { clearTimeout(usersNextTimerRef.current); usersNextTimerRef.current = null; }
      if (propertiesNextTimerRef.current) { clearTimeout(propertiesNextTimerRef.current); propertiesNextTimerRef.current = null; }
      if (tasksNextTimerRef.current) { clearTimeout(tasksNextTimerRef.current); tasksNextTimerRef.current = null; }
      if (dashboardNextTimerRef.current) { clearTimeout(dashboardNextTimerRef.current); dashboardNextTimerRef.current = null; }
      if (brandingNextTimerRef.current) { clearTimeout(brandingNextTimerRef.current); brandingNextTimerRef.current = null; }
      if (analyticsNextTimerRef.current) { clearTimeout(analyticsNextTimerRef.current); analyticsNextTimerRef.current = null; }
      try { leaderChannelRef.current?.close(); } catch {}
      try { eventsChannelRef.current?.close(); } catch {}
      try { guestEventsChannelRef.current?.close(); } catch {}
      try { staffEventsChannelRef.current?.close(); } catch {}
      try { usersEventsChannelRef.current?.close(); } catch {}
      try { propertiesEventsChannelRef.current?.close(); } catch {}
      try { tasksEventsChannelRef.current?.close(); } catch {}
      try { dashboardEventsChannelRef.current?.close(); } catch {}
      try { brandingEventsChannelRef.current?.close(); } catch {}
      try { analyticsEventsChannelRef.current?.close(); } catch {}
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(reconTimer);
      clearInterval(offlineCheckTimer);
      clearInterval(sliTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, tokenHash, runTransport, dispatchEnabled, shadowMode]);

  // Explicit cleanup when transport is disabled at runtime (killswitch/rollout change)
  useEffect(() => {
    if (runTransport) return;
    try { abortRef.current?.abort(); } catch {}
    try { guestAbortRef.current?.abort(); } catch {}
    try { staffAbortRef.current?.abort(); } catch {}
    try { usersAbortRef.current?.abort(); } catch {}
    try { propertiesAbortRef.current?.abort(); } catch {}
    try { tasksAbortRef.current?.abort(); } catch {}
    try { dashboardAbortRef.current?.abort(); } catch {}
    try { brandingAbortRef.current?.abort(); } catch {}
    if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null; }
    if (guestNextTimerRef.current) { clearTimeout(guestNextTimerRef.current); guestNextTimerRef.current = null; }
    if (staffNextTimerRef.current) { clearTimeout(staffNextTimerRef.current); staffNextTimerRef.current = null; }
    if (usersNextTimerRef.current) { clearTimeout(usersNextTimerRef.current); usersNextTimerRef.current = null; }
    if (propertiesNextTimerRef.current) { clearTimeout(propertiesNextTimerRef.current); propertiesNextTimerRef.current = null; }
    if (tasksNextTimerRef.current) { clearTimeout(tasksNextTimerRef.current); tasksNextTimerRef.current = null; }
    if (dashboardNextTimerRef.current) { clearTimeout(dashboardNextTimerRef.current); dashboardNextTimerRef.current = null; }
    if (brandingNextTimerRef.current) { clearTimeout(brandingNextTimerRef.current); brandingNextTimerRef.current = null; }
    if (analyticsNextTimerRef.current) { clearTimeout(analyticsNextTimerRef.current); analyticsNextTimerRef.current = null; }
    try { leaderChannelRef.current?.close(); } catch {}
    try { eventsChannelRef.current?.close(); } catch {}
    try { guestEventsChannelRef.current?.close(); } catch {}
    try { staffEventsChannelRef.current?.close(); } catch {}
    try { usersEventsChannelRef.current?.close(); } catch {}
    try { propertiesEventsChannelRef.current?.close(); } catch {}
    try { tasksEventsChannelRef.current?.close(); } catch {}
    try { dashboardEventsChannelRef.current?.close(); } catch {}
    try { brandingEventsChannelRef.current?.close(); } catch {}
    try { analyticsEventsChannelRef.current?.close(); } catch {}
    if (isLeaderRef.current) {
      resignLeadership();
    }
  }, [runTransport]);

  return null;
}


