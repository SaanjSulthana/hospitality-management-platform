import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { RefreshCw, AlertCircle, CheckCircle, TrendingUp, Database } from 'lucide-react';
import { API_CONFIG } from '@/src/config/api';

interface RealtimeMetrics {
  realtime: {
    buffers: Array<{ orgId: number; size: number }>;
    totals: {
      orgs: number;
      totalDropped: number;
    };
    publishedByType: Record<string, number>;
    deliveredByType: Record<string, number>;
    maxBufferSize: number;
    eventTtlMs: number;
  };
  database?: {
    last24Hours?: Array<{ event_type: string; count: number }>;
  };
}

export function FinanceRealtimeHealthCard() {
  const [data, setData] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      try {
        (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0, metricsFetches: 0, financeMetricsFetches: 0, listRefetchesBurst: 0 };
        (window as any).__realtimeClientStats.financeMetricsFetches++;
      } catch {}
      
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const resp = await fetch(`${API_CONFIG.BASE_URL}/finance/events/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!resp.ok) {
        // Try to parse error message from response
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
      }
      
      // Check if response body is empty
      const text = await resp.text();
      if (!text || text.trim() === '') {
        throw new Error('Empty response from server');
      }
      
      // Parse JSON
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
      }
      
      // Adapt the backend response to our expected format
      // Backend returns: { metrics, realtime, timestamp }
      // We expect: { realtime: { buffers, totals, publishedByType, ... } }
      const adapted: RealtimeMetrics = {
        realtime: json.realtime || {
          buffers: [],
          totals: { orgs: 0, totalDropped: 0 },
          publishedByType: {},
          deliveredByType: {},
          maxBufferSize: 200,
          eventTtlMs: 25000,
        },
        database: json.metrics ? {
          last24Hours: json.metrics.map((m: any) => ({
            event_type: m.event_type,
            count: Number(m.count) || 0,
          })),
        } : undefined,
      };
      
      setData(adapted);
    } catch (err) {
      console.error('Failed to fetch finance realtime metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const fetchIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void fetchMetrics();
    };

    fetchIfVisible();
    // Auto-refresh every 60 seconds when tab is visible
    const interval = setInterval(fetchIfVisible, 60000);

    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchMetrics();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  
  if (error) {
    return (
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            Finance Realtime Health
            <Badge variant="destructive">Error</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-600">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchMetrics} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!data) {
    return (
      <Card className="border-l-4 border-l-gray-300">
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }
  
  const rt = data.realtime;
  const dropped = rt.totals?.totalDropped || 0;
  const buffers = rt.buffers || [];
  const published = rt.publishedByType || {};
  const delivered = rt.deliveredByType || {};
  
  const isHealthy = dropped === 0;
  const topBuffers = buffers
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
  
  // Calculate delivery percentage
  const totalPublished = Object.values(published).reduce((sum, count) => sum + count, 0);
  const totalDelivered = Object.values(delivered).reduce((sum, count) => sum + count, 0);
  const deliveryPct = totalPublished > 0 ? ((totalDelivered / totalPublished) * 100).toFixed(1) : '100';
  
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Finance Realtime Health
          </div>
          <Badge 
            variant={isHealthy ? 'outline' : 'destructive'} 
            className="flex items-center gap-1"
          >
            {isHealthy ? (
              <CheckCircle className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {isHealthy ? 'Healthy' : `${dropped} Drops`}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4 text-xs">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-gray-600 text-[10px] uppercase font-medium mb-1">Active Buffers</div>
            <div className="text-lg font-bold text-blue-700">{buffers.length}</div>
            <div className="text-[10px] text-gray-500">org streams</div>
          </div>
          
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <div className="text-gray-600 text-[10px] uppercase font-medium mb-1">Delivery Rate</div>
            <div className="text-lg font-bold text-green-700">{deliveryPct}%</div>
            <div className="text-[10px] text-gray-500">{totalDelivered}/{totalPublished} events</div>
          </div>
        </div>
        
        {/* Top Buffers */}
        {topBuffers.length > 0 && (
          <div>
            <div className="font-medium mb-2 flex items-center gap-1">
              <Database className="h-3 w-3 text-gray-600" />
              Top Buffers (by size)
            </div>
            <div className="space-y-1">
              {topBuffers.map((b) => (
                <div key={b.orgId} className="flex justify-between items-center p-1.5 bg-gray-50 rounded">
                  <span className="text-gray-700 font-medium">Org {b.orgId}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {b.size} events
                  </Badge>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Max: {rt.maxBufferSize} events/org, TTL: {(rt.eventTtlMs / 1000).toFixed(0)}s
            </div>
          </div>
        )}
        
        {/* Event Types Delivery Status */}
        <div>
          <div className="font-medium mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-gray-600" />
            Delivery by Event Type
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.keys(published).length > 0 ? (
              Object.keys(published)
                .sort((a, b) => (published[b] || 0) - (published[a] || 0))
                .map((type) => {
                  const pub = published[type] || 0;
                  const del = delivered[type] || 0;
                  const pct = pub > 0 ? ((del / pub) * 100).toFixed(0) : '100';
                  const ok = del >= pub * 0.9;
                  
                  return (
                    <div key={type} className="flex justify-between items-center p-1.5 bg-gray-50 rounded text-[11px]">
                      <span className="text-gray-700 truncate flex-1">{type.replace(/_/g, ' ')}</span>
                      <span className={ok ? 'text-green-700 font-medium' : 'text-orange-700 font-medium'}>
                        {del}/{pub} ({pct}%)
                      </span>
                    </div>
                  );
                })
            ) : (
              <div className="text-gray-500 text-center py-2">No events yet</div>
            )}
          </div>
        </div>
        
        {/* Dropped Events Warning */}
        {dropped > 0 && (
          <div className="p-2 bg-red-50 rounded border border-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-900">Dropped Events Detected</div>
                <div className="text-[10px] text-red-700 mt-1">
                  {dropped} events have been dropped due to buffer overflow. 
                  Consider scaling subscribers or adjusting buffer size.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Refresh Button */}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={fetchMetrics} 
          disabled={loading}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Metrics'}
        </Button>
        
        <div className="text-[10px] text-gray-500 text-center pt-2 border-t">
          Metrics auto-refresh every 60 seconds
        </div>
      </CardContent>
    </Card>
  );
}

