import { useEffect } from 'react';

/**
 * Standardized hook to attach/detach realtime service listeners.
 * Ensures one handler and proper cleanup.
 */
export function useRealtimeService(
  service: string,
  handler: (events: any[]) => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const onEvents = (e: any) => {
      const events = e?.detail?.events || [];
      if (Array.isArray(events) && events.length > 0) {
        try { handler(events); } catch {}
      }
    };
    const channel = `${service}-stream-events`;
    window.addEventListener(channel, onEvents as EventListener);
    return () => {
      window.removeEventListener(channel, onEvents as EventListener);
    };
  }, [service, handler, enabled]);
}


