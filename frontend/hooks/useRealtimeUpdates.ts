import { useState, useEffect } from 'react';
import { backend } from '@/services/backend';

export function useRealtimeUpdates(enabled: boolean = true) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const pollInterval = setInterval(async () => {
      try {
        setIsPolling(true);
        const response = await backend.get('/reports/realtime/poll', {
          params: { lastUpdateTime: lastUpdate.toISOString() }
        });
        
        if (response.data.updates.length > 0) {
          // Trigger refresh
          setLastUpdate(new Date());
          // Emit event for components to refetch
          window.dispatchEvent(new CustomEvent('finance-update'));
        }
      } catch (error) {
        console.error('Polling error:', error);
      } finally {
        setIsPolling(false);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [enabled, lastUpdate]);

  return { lastUpdate, isPolling };
}
