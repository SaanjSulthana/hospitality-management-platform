/**
 * Optimized Audit Logs Real-Time Hook (v2)
 * 
 * SCALABILITY IMPROVEMENTS:
 * - Uses long-polling instead of rapid polling
 * - Waits for ACTUAL events (no wasteful COUNT queries)
 * - Auto-reconnects on connection loss
 * - Stops polling when tab is hidden (battery/bandwidth saving)
 */

import { useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../src/config/api';

interface SubscribeResponse {
  events?: Array<{ eventType: string; metadata?: { newCount: number } }>;
  lastEventId?: string;
}

export function useAuditLogsRealtimeV2(
  enabled: boolean,
  onUpdate: () => void
) {
  const lastEventIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep callback ref up to date without causing reconnections
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(async () => {
    if (!enabled) return;

    // Cancel previous connection if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    console.log('🔌 Connecting to audit events long-poll...');

    try {
      const params = new URLSearchParams();
      if (lastEventIdRef.current) {
        params.set('lastEventId', lastEventIdRef.current);
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/guest-checkin/audit-events/subscribe?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
          },
          signal: abortControllerRef.current.signal,
          // Long-polling: wait up to 30 seconds
        }
      );

      if (!response.ok) {
        throw new Error(`Subscription failed: ${response.status}`);
      }

      // Safe JSON parsing for empty/204 responses
      let data: SubscribeResponse;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : { events: [], lastEventId: new Date().toISOString() };
      } catch (parseError) {
        console.warn('Failed to parse subscription response, using empty data:', parseError);
        data = { events: [], lastEventId: new Date().toISOString() };
      }

      if (data.lastEventId) {
        lastEventIdRef.current = data.lastEventId;
      }

      if (data.events && data.events.length > 0) {
        console.log('📢 Audit logs changed, triggering refresh...', {
          eventCount: data.events.length,
          events: data.events,
          lastEventId: data.lastEventId
        });
        onUpdateRef.current(); // Use ref instead of closure
        console.log('✅ Refresh callback executed');
      } else {
        console.log('⏰ Long-poll timeout (no events), reconnecting...');
      }

      // Immediately reconnect (long-polling loop)
      if (enabled) {
        connect();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Connection was intentionally aborted
        return;
      }

      console.error('Audit subscription error:', error);

      // Exponential backoff retry (1s, 2s, 4s, max 10s)
      const retryDelay = Math.min(10000, 1000 * Math.pow(2, Math.floor(Math.random() * 3)));
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, retryDelay);
    }
  }, [enabled]); // Removed onUpdate from dependencies!

  useEffect(() => {
    if (!enabled) {
      // Cleanup on disable
      console.log('🔌 Audit logs tab inactive, disconnecting...');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // Start connection
    console.log('🔌 Audit logs tab active, starting long-poll...');
    connect();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);

  // Pause polling when tab is hidden (performance optimization)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden: abort connection
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      } else {
        // Tab visible: reconnect
        if (enabled) {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, connect]);
}

