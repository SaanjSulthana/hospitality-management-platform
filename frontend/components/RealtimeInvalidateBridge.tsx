import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * RealtimeInvalidateBridge
 * Listens to transport-level invalidate frames and translates them into
 * React Query invalidations. Non-invasive and safe if no frames are sent.
 */
export default function RealtimeInvalidateBridge(): null {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initialize simple dev counters and a periodic console reporter
    try {
      (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0, metricsFetches: 0, financeMetricsFetches: 0, listRefetchesBurst: 0 };
      if (!(window as any).__realtimeDevReporter) {
        (window as any).__realtimeDevReporter = setInterval(() => {
          try {
            const s = (window as any).__realtimeClientStats;
            // Basic per-minute snapshot (dev only)
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[realtime] metrics/min', { metrics: s.metricsFetches, financeMetrics: s.financeMetricsFetches, invalidationsFlushed: s.invalidationsFlushed, keys: s.keys, listRefetchesBurst: s.listRefetchesBurst });
            }
            // Reset per-minute counters
            s.metricsFetches = 0;
            s.financeMetricsFetches = 0;
            s.listRefetchesBurst = 0;
          } catch {}
        }, 60000);
      }
    } catch {}

    // Coalesce invalidations within a short window to avoid refetch storms
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (pending.size === 0) return;
      const keys = Array.from(pending.values());
      pending.clear();
      try {
        (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0 };
        (window as any).__realtimeClientStats.invalidationsFlushed++;
        (window as any).__realtimeClientStats.keys += keys.length;
        (window as any).__realtimeClientStats.listRefetchesBurst = ((window as any).__realtimeClientStats.listRefetchesBurst || 0) + keys.length;
      } catch {}
      for (const k of keys) {
        try {
          // Ensure key format for React Query
          const queryKey = k.startsWith('[') ? (JSON.parse(k) as string[]) : [k];
          queryClient.invalidateQueries({ queryKey });
        } catch {
          // Fallback: treat as simple key
          queryClient.invalidateQueries({ queryKey: [k] });
        }
      }
    };

    const onInvalidate = (e: any) => {
      const keys = e?.detail?.keys;
      if (!Array.isArray(keys) || keys.length === 0) return;
      for (const key of keys) {
        const asString = Array.isArray(key) ? JSON.stringify(key) : String(key);
        pending.add(asString);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 350);
    };

    window.addEventListener('realtime-invalidate', onInvalidate as EventListener);
    return () => {
      window.removeEventListener('realtime-invalidate', onInvalidate as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);

  return null;
}


