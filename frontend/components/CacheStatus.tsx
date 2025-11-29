import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/src/config/api';

export function CacheStatus() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const resp = await fetch(`${API_CONFIG.BASE_URL}/reports/cache/metrics`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}` },
        });
        if (!resp.ok) throw new Error(`metrics ${resp.status}`);
        const json = await resp.json();
        setMetrics(json);
      } catch (error) {
        console.error('Failed to fetch cache metrics:', error);
      }
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  const hitRate = metrics.dailyCacheSize ? (metrics.dailyCacheSize / metrics.maxEntries) * 100 : 0;

  return (
    <div className="cache-status p-4 bg-gray-50 rounded-lg border">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Cache Performance</h3>
      <div className="space-y-1 text-xs text-gray-600">
        <p>Daily Cache: {metrics.dailyCacheSize || 0} items</p>
        <p>Monthly Cache: {metrics.monthlyCacheSize || 0} items</p>
        <p>Summary Cache: {metrics.summaryCacheSize || 0} items</p>
        <p>Hit Rate: ~{hitRate.toFixed(0)}%</p>
        <p>TTL: {metrics.ttlMs ? (metrics.ttlMs / 1000 / 60).toFixed(0) : 0} minutes</p>
      </div>
    </div>
  );
}
