/**
 * Guest Check-In Realtime Hook V3
 * 
 * Production-grade realtime hook with:
 * - Leader/Follower pattern (only 1 tab long-polls per session)
 * - BroadcastChannel for tab coordination
 * - RTT-aware backoff (fast-empty detection)
 * - Auth-control listener for logout coordination
 * - Visibility-based backoff (battery/bandwidth saving)
 * - Telemetry (2% sample rate)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_CONFIG } from '../src/config/api';

// Constants
const LONG_POLL_TIMEOUT = 25_000;
const FAST_EMPTY_THRESHOLD_MS = 1500;
const FAST_EMPTY_BACKOFF_MS: [number, number] = [2000, 5000];
const HIDDEN_BACKOFF_MS: [number, number] = [3000, 5000];
const FOLLOWER_BACKOFF_MS: [number, number] = [3000, 5000];
const LEADER_LEASE_MS = 10_000;
const TELEMETRY_SAMPLE_RATE = 0.02; // 2%

interface GuestCheckInEvent {
  eventType: string;
  timestamp: string;
  entityId: number;
  entityType: string;
  metadata?: Record<string, unknown>;
}

interface RealtimeOptions {
  propertyId?: number;
  enabled?: boolean;
  onEvents?: (events: GuestCheckInEvent[]) => void;
}

/**
 * Leader/Follower realtime hook with RTT-aware backoff
 */
export function useGuestCheckInRealtimeV3(options: RealtimeOptions = {}) {
  const { propertyId, enabled = true, onEvents } = options;
  const { user } = useAuth();
  
  const [isLeader, setIsLeader] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const leaderLeaseRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const resubscribeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('guest-checkin-events');
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
          'guest-checkin-realtime-leader',
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
      const leaseKey = 'guest-checkin-leader-lease';
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
      console.error('[GuestCheckInRealtimeV3] Failed to acquire lease:', error);
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
            'guest-checkin-leader-lease',
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
    if (!enabled || !user) {
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
    const token = localStorage.getItem('accessToken');
    
    try {
      const url = new URL('/v1/guest-checkin/realtime/subscribe-v3', API_CONFIG.BASE_URL);
      if (propertyId) {
        url.searchParams.set('propertyId', propertyId.toString());
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
      
      console.error('[GuestCheckInRealtimeV3] Long-poll error:', error);
      setIsConnected(false);
      
      // Exponential backoff on errors
      const backoff = Math.min(2000 * Math.pow(2, Math.random()), 60000);
      if (resubscribeTimerRef.current) clearTimeout(resubscribeTimerRef.current);
      resubscribeTimerRef.current = setTimeout(longPoll, backoff);
    }
  }, [enabled, user, propertyId, isLeader, onEvents, acquireLease]);
  
  // Start long-poll when conditions met
  useEffect(() => {
    if (enabled && user) {
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
  }, [enabled, user, propertyId]);
  
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
    await fetch(`${API_CONFIG.BASE_URL}/telemetry/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        timestamp: Date.now(),
        domain: 'guest-checkin',
        ...data,
      }),
    });
  } catch {
    // Silently fail
  }
}

