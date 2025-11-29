import { useEffect, useRef } from 'react';

import { API_CONFIG } from '../src/config/api';

interface SubscribeResponse {
  events?: Array<{ eventType: string }>;
  lastEventId?: string;
}

/**
 * Subscribes to guest check-in change events using lightweight polling.
 * Triggers the provided callback whenever the backend reports changes.
 */
export function useGuestCheckinRealtime(
  enabled: boolean,
  onUpdate: () => void,
  intervalMs: number = 3000
) {
  const lastEventIdRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;

    const run = async () => {
      const params = new URLSearchParams();
      if (lastEventIdRef.current) {
        params.set('lastEventId', lastEventIdRef.current);
      }

      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/guest-checkin/events/subscribe?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
            },
          }
        );

        if (!response.ok) {
          return;
        }

        // Safe JSON parsing
        let data: SubscribeResponse;
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : { events: [], lastEventId: new Date().toISOString() };
        } catch {
          data = { events: [], lastEventId: new Date().toISOString() };
        }

        if (!isMounted) {
          return;
        }

        if (data.lastEventId) {
          lastEventIdRef.current = data.lastEventId;
        }

        if (data.events && data.events.length > 0) {
          onUpdate();
        }
      } catch {
        // Swallow errors and retry on next tick.
      }
    };

    // Immediately invoke once so the list is fresh when enabling.
    run();
    const interval = setInterval(run, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [enabled, intervalMs, onUpdate]);
}


