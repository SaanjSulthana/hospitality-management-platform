import { useEffect, useRef, useCallback } from 'react';
import { API_CONFIG } from '../src/config/api';

interface SubscribeResponse {
  events?: Array<{
    eventType: string;
    entityId: number;
    entityType: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  lastEventId?: string;
}

export function useGuestCheckinRealtimeV2(
  enabled: boolean,
  onUpdate: (events?: SubscribeResponse['events']) => void
) {
  const lastEventIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(async () => {
    if (!enabled) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams();
      if (lastEventIdRef.current) params.set('lastEventId', lastEventIdRef.current);

      const resp = await fetch(
        `${API_CONFIG.BASE_URL}/guest-checkin/realtime/subscribe?${params.toString()}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
          signal: abortControllerRef.current.signal,
        }
      );

      if (!resp.ok) throw new Error(`Subscription failed: ${resp.status}`);

      // Safely parse JSON; tolerate 204/empty bodies
      let data: SubscribeResponse = { events: [], lastEventId: '' };
      try {
        const text = await resp.text();
        if (text) {
          data = JSON.parse(text);
        } else {
          data = { events: [], lastEventId: new Date().toISOString() };
        }
      } catch {
        data = { events: [], lastEventId: new Date().toISOString() };
      }
      if (data.lastEventId) lastEventIdRef.current = data.lastEventId;

      if (data.events && data.events.length > 0) {
        onUpdateRef.current(data.events);
      }

      if (enabled) connect();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const retry = Math.min(10000, 1000 * (1 + Math.floor(Math.random() * 4)));
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) connect();
      }, retry);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
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

    connect();

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [enabled, connect]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (abortControllerRef.current) abortControllerRef.current.abort();
      } else if (enabled) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, connect]);
}


