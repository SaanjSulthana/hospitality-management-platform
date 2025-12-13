import React, { useEffect, useState } from 'react';
import { API_CONFIG } from '@/src/config/api';
import { getFlagBool } from '@/lib/feature-flags';

interface Metrics {
  activeConnections: number;
  totalConnections: number;
  eventsDelivered: number;
  errorCount: number;
}

export default function RealtimeHealthBadge() {
  const [connected, setConnected] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const pollingEnabled = getFlagBool('REALTIME_HEALTH_BADGE', false);

  const fetchMetrics = async () => {
    try {
      try {
        (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0, metricsFetches: 0, financeMetricsFetches: 0, listRefetchesBurst: 0 };
        (window as any).__realtimeClientStats.metricsFetches++;
      } catch {}
      const resp = await fetch(`${API_CONFIG.BASE_URL}/v2/realtime/metrics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}` },
      });
      if (!resp.ok) throw new Error(`metrics ${resp.status}`);
      const data = await resp.json();
      setMetrics({
        activeConnections: data.activeConnections,
        totalConnections: data.totalConnections,
        eventsDelivered: data.eventsDelivered,
        errorCount: data.errorCount,
      });
      setConnected(data.activeConnections > 0);
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    if (!pollingEnabled) return;

    const fetchIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void fetchMetrics();
    };

    fetchIfVisible();
    const id = setInterval(fetchIfVisible, 60000);

    const onVis = () => { if (document.visibilityState === 'visible') void fetchMetrics(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pollingEnabled]);

  const dotClass = connected ? 'bg-green-500' : 'bg-gray-400';
  const title = connected ? 'Realtime connected' : 'Realtime disconnected';

  return (
    <div className="hidden lg:flex items-center gap-2 text-xs text-gray-600" title={title}>
      <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
      <span>Realtime</span>
      {metrics && (
        <span className="text-gray-500">
          · {metrics.activeConnections} conn · {metrics.eventsDelivered} ev
        </span>
      )}
    </div>
  );
}


