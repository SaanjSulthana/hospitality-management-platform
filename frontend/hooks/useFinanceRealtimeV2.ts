import { useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../src/config/api';
import { getAccessTokenHash, getFlagBool } from '../lib/feature-flags';

type Options = {
  enabled?: boolean;
  propertyId?: number;
};

type FinanceStreamHealth = {
  isLive: boolean;
  lastEventAt?: Date;
  lastSuccessAt?: Date;
  failures: number;
};

export function useFinanceRealtimeV2(options: Options = {}) {
  const { enabled = true, propertyId } = options;
  const lastEventIdRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResumeAtRef = useRef<number>(0);
  const [health, setHealth] = useState<FinanceStreamHealth>({ isLive: false, failures: 0 });
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const isLeaderRef = useRef<boolean>(false);
  useEffect(() => { isLeaderRef.current = isLeader; }, [isLeader]);
  const leaderEnabled = getFlagBool('FIN_LEADER_ENABLED', true);
  const tokenHash = getAccessTokenHash(); // scope leadership to same auth token
  const tabIdRef = useRef<string>(
    (() => {
      try {
        const existing = sessionStorage.getItem('finance-tab-id');
        if (existing) return existing;
        const id = Math.random().toString(36).slice(2);
        sessionStorage.setItem('finance-tab-id', id);
        return id;
      } catch {
        return Math.random().toString(36).slice(2);
      }
    })()
  );
  const leaderLeaseKey = tokenHash ? `finance-leader-lease:${tokenHash}` : null;
  const leaderChannelName = tokenHash ? `finance-leader:${tokenHash}` : null;
  const eventsChannelName = tokenHash ? `finance-events:${tokenHash}` : null;
  const telemetrySampleRate = 0.02; // 2% sampling
  const leaderChannelRef = useRef<BroadcastChannel | null>(null);
  const eventsChannelRef = useRef<BroadcastChannel | null>(null);
  const lastLeaderHeartbeatRef = useRef<number>(0);
  const authControlChannelRef = useRef<BroadcastChannel | null>(null);
  const stoppedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let backoffMs = 1000;
    const HEARTBEAT_MS = 10000; // 10s
    const TAKEOVER_MS = 18000; // 18s

    function now() { return Date.now(); }

    function sendLeaderHeartbeat() {
      try {
        if (!leaderChannelRef.current) return;
        leaderChannelRef.current.postMessage({ t: 'hb', at: Date.now(), tabId: tabIdRef.current });
      } catch {}
    }

    function renewLease() {
      if (!leaderLeaseKey) return;
      try {
        const lease = { owner: tabIdRef.current, exp: now() + TAKEOVER_MS + Math.floor(Math.random() * 500) };
        localStorage.setItem(leaderLeaseKey, JSON.stringify(lease));
      } catch {}
    }

    function tryBecomeLeader(): boolean {
      if (!leaderEnabled || !leaderLeaseKey) return false;
      try {
        const raw = localStorage.getItem(leaderLeaseKey);
        const data = raw ? JSON.parse(raw) : null;
        if (!data || !data.exp || data.exp < now()) {
          renewLease();
          setIsLeader(true);
          sendLeaderHeartbeat();
          // Telemetry: leader_acquired/leader_takeover
          if (Math.random() < telemetrySampleRate) {
            fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sampleRate: telemetrySampleRate,
                events: [{ type: data ? 'leader_takeover' : 'leader_acquired', ts: new Date().toISOString() }],
              }),
            }).catch(() => {});
          }
          return true;
        }
        // Someone else owns a valid lease
        setIsLeader(false);
        return false;
      } catch {
        // On parse error, take over
        renewLease();
        setIsLeader(true);
        sendLeaderHeartbeat();
        if (Math.random() < telemetrySampleRate) {
          fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sampleRate: telemetrySampleRate,
              events: [{ type: 'leader_takeover', ts: new Date().toISOString() }],
            }),
          }).catch(() => {});
        }
        return true;
      }
    }

    // Setup channels
    if (leaderEnabled && tokenHash && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      leaderChannelRef.current = new BroadcastChannel(leaderChannelName!);
      leaderChannelRef.current.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.t === 'hb') {
          lastLeaderHeartbeatRef.current = now();
          // Followership maintained
        }
      };

      eventsChannelRef.current = new BroadcastChannel(eventsChannelName!);
      eventsChannelRef.current.onmessage = (ev) => {
        const data = ev.data;
        if (Array.isArray(data?.events)) {
          window.dispatchEvent(new CustomEvent('finance-stream-events', { detail: { events: data.events } }));
          setHealth(h => ({ isLive: true, failures: 0, lastEventAt: new Date(), lastSuccessAt: new Date() }));
        }
      };

      // Listen for cross-tab logout
      try {
        authControlChannelRef.current = new BroadcastChannel('auth-control');
        authControlChannelRef.current.onmessage = (ev) => {
          if (ev.data?.t === 'logout') {
            stoppedRef.current = true;
            abortRef.current?.abort();
            if (nextTimerRef.current) {
              clearTimeout(nextTimerRef.current);
              nextTimerRef.current = null;
            }
          }
        };
      } catch {}

      // Initial leader attempt
      tryBecomeLeader();
    } else {
      setIsLeader(true); // fallback: behave as single-tab leader
    }

    const subscribe = async () => {
      if (!active) return;
      if (stoppedRef.current) return;

      // Pause when tab is hidden to reduce load
      if (document.visibilityState === 'hidden') {
        nextTimerRef.current && clearTimeout(nextTimerRef.current);
        // hidden tabs: slower cadence to reduce churn
        const sleep = 3000 + Math.floor(Math.random() * 2000);
        nextTimerRef.current = setTimeout(subscribe, sleep);
        return;
      }

      // Followers don't long-poll; they just wait for leader broadcasts
      if (leaderEnabled && !isLeaderRef.current) {
        // Monitor leader heartbeat; if leader silent, attempt takeover
        if (leaderLeaseKey) {
          try {
            const raw = localStorage.getItem(leaderLeaseKey);
            const data = raw ? JSON.parse(raw) : null;
            if (!data || data.exp < now()) {
              tryBecomeLeader();
            }
          } catch {
            tryBecomeLeader();
          }
        }
        nextTimerRef.current && clearTimeout(nextTimerRef.current);
        const sleep = 3000 + Math.floor(Math.random() * 2000); // 3–5s
        nextTimerRef.current = setTimeout(subscribe, sleep);
        return;
      }

      // Avoid overlapping requests; let the current one finish
      if (inFlightRef.current) {
        // Coalesce to a single pipeline
        return;
      }

      // Create a new controller for this round
      const controller = new AbortController();
      abortRef.current = controller; // Only used for filter changes/unmounts

      try {
        inFlightRef.current = true;
        const url = new URL(`${API_CONFIG.BASE_URL}/finance/realtime/subscribe`);
        if (lastEventIdRef.current) url.searchParams.set('lastEventId', lastEventIdRef.current);
        // Leader subscribes for all properties to fan out to followers
        if (!leaderEnabled && propertyId) url.searchParams.set('propertyId', String(propertyId));

        const startedAt = Date.now();
        // Authorization guard: if token missing, avoid sending empty Bearer header
        const token = localStorage.getItem('accessToken');
        if (!token) {
          inFlightRef.current = false;
          backoffMs = 2000;
          return;
        }
        const resp = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!resp.ok) throw new Error(`Realtime subscribe failed: ${resp.status}`);
        const data = await resp.json();
        const elapsed = Date.now() - startedAt;

        // Dispatch events to the app; consumers can update row-level state
        if (Array.isArray(data?.events) && data.events.length > 0) {
          window.dispatchEvent(new CustomEvent('finance-stream-events', { detail: { events: data.events } }));
          // Also broadcast to followers if we are leader
          if (leaderEnabled && isLeaderRef.current && eventsChannelRef.current) {
            try { eventsChannelRef.current.postMessage({ events: data.events }); } catch {}
          }
          lastEventIdRef.current = data.lastEventId || lastEventIdRef.current;
          setHealth(h => ({ isLive: true, failures: 0, lastEventAt: new Date(data.lastEventId || Date.now()), lastSuccessAt: new Date() }));
          backoffMs = 500; // fast again after success (but never <500ms)
        } else {
          // heartbeat success with no events
          setHealth(h => ({ ...h, isLive: true, lastSuccessAt: new Date() }));
          // RTT-aware backoff to avoid tight loops when server returns empty too fast
          if (elapsed < 1500) {
            backoffMs = 2000 + Math.floor(Math.random() * 3000); // 2–5s
            // Telemetry: fast_empty
            if (Math.random() < telemetrySampleRate) {
              fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  sampleRate: telemetrySampleRate,
                  events: [{
                    type: 'fast_empty',
                    elapsedMs: elapsed,
                    backoffMs: backoffMs,
                    isLeader: isLeaderRef.current,
                    ts: new Date().toISOString(),
                  }],
                }),
              }).catch(() => {});
            }
          } else {
            backoffMs = 1200;
          }
        }

        // Maintain leadership lease/heartbeat
        if (leaderEnabled && isLeaderRef.current) {
          renewLease();
          sendLeaderHeartbeat();
        }
      } catch (err) {
        // On failure, back off
        setHealth(h => ({ ...h, isLive: false, failures: h.failures + 1 }));
        backoffMs = Math.min(backoffMs * 2, 5000);
      } finally {
        inFlightRef.current = false;
        if (active) {
          nextTimerRef.current && clearTimeout(nextTimerRef.current);
          nextTimerRef.current = setTimeout(subscribe, backoffMs);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Throttle resumes to avoid thrash while devtools/focus toggles
        const now = Date.now();
        if (now - lastResumeAtRef.current < 500) return;
        lastResumeAtRef.current = now;
        if (!inFlightRef.current) {
          nextTimerRef.current && clearTimeout(nextTimerRef.current);
          nextTimerRef.current = setTimeout(subscribe, 0);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // initial kick
    subscribe();

    return () => {
      active = false;
      abortRef.current?.abort(); // cancel in-flight on unmount
      if (nextTimerRef.current) {
        clearTimeout(nextTimerRef.current);
        nextTimerRef.current = null;
      }
      try { leaderChannelRef.current?.close(); } catch {}
      try { eventsChannelRef.current?.close(); } catch {}
      try { authControlChannelRef.current?.close(); } catch {}
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, propertyId, leaderEnabled]);

  // Reset stream cursor when filters change to avoid gaps
  useEffect(() => {
    lastEventIdRef.current = '';
    // Abort any in-flight request to restart immediately with new filter
    abortRef.current?.abort();
    inFlightRef.current = false;
  }, [propertyId]);

  // Broadcast health for badges
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('finance-stream-health', { detail: health }));
  }, [health]);

  return { health };
}


