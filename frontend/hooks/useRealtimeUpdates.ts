import { useState, useEffect } from 'react';
// import { backend } from '@/services/backend';

/**
 * useRealtimeUpdates - DISABLED
 * 
 * REASON: This 3-second polling hook causes excessive network requests.
 * Real-time updates should come from RealtimeProviderV2_Fixed via WebSocket.
 * 
 * The hook is kept for backwards compatibility but polling is disabled.
 * Components should listen to WebSocket events instead.
 */
export function useRealtimeUpdates(enabled: boolean = true) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isPolling] = useState(false);

  useEffect(() => {
    // DISABLED: Polling causes excessive network requests
    // Real-time updates should come from WebSocket via RealtimeProviderV2_Fixed
    console.log('[useRealtimeUpdates] Polling disabled - use WebSocket for real-time updates');
    
    /* DISABLED CODE:
    if (!enabled) return;

    const pollInterval = setInterval(async () => {
      try {
        setIsPolling(true);
        const response = await backend.get('/reports/realtime/poll', {
          params: { lastUpdateTime: lastUpdate.toISOString() }
        });
        
        if (response.data.updates.length > 0) {
          setLastUpdate(new Date());
          window.dispatchEvent(new CustomEvent('finance-update'));
        }
      } catch (error) {
        console.error('Polling error:', error);
      } finally {
        setIsPolling(false);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
    */
  }, [enabled]);

  return { lastUpdate, isPolling };
}
