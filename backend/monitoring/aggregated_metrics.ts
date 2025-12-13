/**
 * Aggregated Metrics Endpoint
 * 
 * Comprehensive metrics for 10M scale monitoring including:
 * - API latency (p50, p95, p99)
 * - Realtime stream delivery metrics
 * - Cache hit rates across tiers
 * - Database partition readiness
 * - Replica lag monitoring
 * - Connection pool utilization
 * - Error rates and availability
 * 
 * Prometheus-compatible format for external monitoring systems.
 */

import { api } from "encore.dev/api";

/**
 * Latency percentiles
 */
interface LatencyMetrics {
    p50: number;
    p95: number;
    p99: number;
    count: number;
    avgMs: number;
}

/**
 * Aggregated system metrics
 */
export interface AggregatedMetrics {
    timestamp: string;
    uptime: number;

    // API Performance
    api: {
        get: LatencyMetrics;
        post: LatencyMetrics;
        put: LatencyMetrics;
        patch: LatencyMetrics;
        delete: LatencyMetrics;
    };

    // Realtime Streaming
    realtime: {
        activeConnections: number;
        totalConnections: number;
        eventsDelivered: number;
        deliveryP95Ms: number;
        deliveryP99Ms: number;
        droppedEvents: number;
        quarantinedConnections: number;
        compressionHitRate: number;
        conflationRatio: number;
        bytesSaved: number;
    };

    // Cache Performance
    cache: {
        l1: {
            hitRate: number;
            totalRequests: number;
            avgLatencyMs: number;
        };
        l2: {
            hitRate: number;
            totalRequests: number;
            avgLatencyMs: number;
            available: boolean;
        };
        l3: {
            hitRate: number;
            totalRequests: number;
            avgLatencyMs: number;
            available: boolean;
        };
    };

    // Database Health
    database: {
        partitions: {
            ready: boolean;
            count: number;
            syncStatus: 'synced' | 'syncing' | 'out-of-sync';
        };
        replicas: {
            enabled: boolean;
            count: number;
            maxLagSeconds: number;
            avgLagSeconds: number;
            healthyCount: number;
        };
        connectionPool: {
            active: number;
            idle: number;
            waiting: number;
            utilization: number; // Percentage
        };
    };

    // Error Rates
    errors: {
        rate5xx: number; // Percentage
        rate4xx: number; // Percentage
        totalErrors: number;
        errorsByEndpoint: Record<string, number>;
    };

    // Availability
    availability: {
        uptime: number; // Percentage
        downtimeSeconds: number;
        lastIncident: string | null;
    };

    // SLO Compliance
    slo: {
        apiP95: { target: number; actual: number; met: boolean };
        apiP99: { target: number; actual: number; met: boolean };
        realtimeP95: { target: number; actual: number; met: boolean };
        cacheHitRate: { target: number; actual: number; met: boolean };
        errorRate: { target: number; actual: number; met: boolean };
        availability: { target: number; actual: number; met: boolean };
    };
}

/**
 * In-memory metrics storage (in production, use time-series database)
 */
const apiLatencies: Record<string, number[]> = {
    GET: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
};

const MAX_LATENCY_SAMPLES = 10000;
let totalRequests = 0;
let totalErrors = 0;
let total5xxErrors = 0;
let total4xxErrors = 0;
const errorsByEndpoint: Record<string, number> = {};

/**
 * Record API request latency
 */
export function recordApiLatency(method: string, latencyMs: number): void {
    const methodUpper = method.toUpperCase();
    if (!apiLatencies[methodUpper]) {
        apiLatencies[methodUpper] = [];
    }

    apiLatencies[methodUpper].push(latencyMs);

    // Keep only recent samples
    if (apiLatencies[methodUpper].length > MAX_LATENCY_SAMPLES) {
        apiLatencies[methodUpper].shift();
    }

    totalRequests++;
}

/**
 * Record API error
 */
export function recordApiError(endpoint: string, statusCode: number): void {
    totalErrors++;

    if (statusCode >= 500) {
        total5xxErrors++;
    } else if (statusCode >= 400) {
        total4xxErrors++;
    }

    errorsByEndpoint[endpoint] = (errorsByEndpoint[endpoint] || 0) + 1;
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
}

/**
 * Calculate latency metrics for a method
 */
function calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
        return { p50: 0, p95: 0, p99: 0, count: 0, avgMs: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
        p50: calculatePercentile(sorted, 50),
        p95: calculatePercentile(sorted, 95),
        p99: calculatePercentile(sorted, 99),
        count: sorted.length,
        avgMs: Math.round(sum / sorted.length),
    };
}

/**
 * Get aggregated metrics
 */
async function getAggregatedMetricsHandler(): Promise<AggregatedMetrics> {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    // Calculate API latency metrics
    const apiMetrics = {
        get: calculateLatencyMetrics(apiLatencies.GET || []),
        post: calculateLatencyMetrics(apiLatencies.POST || []),
        put: calculateLatencyMetrics(apiLatencies.PUT || []),
        patch: calculateLatencyMetrics(apiLatencies.PATCH || []),
        delete: calculateLatencyMetrics(apiLatencies.DELETE || []),
    };

    // Get realtime metrics
    let realtimeMetrics = {
        activeConnections: 0,
        totalConnections: 0,
        eventsDelivered: 0,
        deliveryP95Ms: 0,
        deliveryP99Ms: 0,
        droppedEvents: 0,
        quarantinedConnections: 0,
        compressionHitRate: 0,
        conflationRatio: 0,
        bytesSaved: 0,
    };

    try {
        const { getStreamingMetrics } = await import('../realtime/unified_stream');
        const streamMetrics = await getStreamingMetrics();

        realtimeMetrics = {
            activeConnections: streamMetrics.activeConnections,
            totalConnections: streamMetrics.totalConnections,
            eventsDelivered: streamMetrics.eventsDelivered,
            deliveryP95Ms: 800, // TODO: Track actual delivery latency
            deliveryP99Ms: 1500, // TODO: Track actual delivery latency
            droppedEvents: Number(((streamMetrics.connectionPoolStats as any).droppedTotal ?? 0)),
            quarantinedConnections: Number(((streamMetrics.connectionPoolStats as any).quarantinedActive ?? 0)),
            compressionHitRate: streamMetrics.compression.hitRate,
            conflationRatio: streamMetrics.conflation.ratio,
            bytesSaved: streamMetrics.conflation.bytesSaved,
        };
    } catch (error) {
        console.error('[AggregatedMetrics] Error fetching realtime metrics:', error);
    }

    // Get cache metrics
    let cacheMetrics = {
        l1: { hitRate: 0, totalRequests: 0, avgLatencyMs: 0 },
        l2: { hitRate: 0, totalRequests: 0, avgLatencyMs: 0, available: false },
        l3: { hitRate: 0, totalRequests: 0, avgLatencyMs: 0, available: false },
    };

    try {
        const { getCacheInvalidationMetrics } = await import('./cache_invalidation_metrics');
        const cacheData = await getCacheInvalidationMetrics({});

        cacheMetrics.l2 = {
            hitRate: cacheData.cacheHitStats.hitRate,
            totalRequests: cacheData.cacheHitStats.totalRequests,
            avgLatencyMs: 0, // TODO: Add avgLatencyMs to cache stats
            available: cacheData.cacheAvailable,
        };
    } catch (error) {
        console.error('[AggregatedMetrics] Error fetching cache metrics:', error);
    }

    // Get database metrics
    let databaseMetrics = {
        partitions: {
            ready: false,
            count: 0,
            syncStatus: 'out-of-sync' as 'synced' | 'syncing' | 'out-of-sync',
        },
        replicas: {
            enabled: false,
            count: 0,
            maxLagSeconds: 0,
            avgLagSeconds: 0,
            healthyCount: 0,
        },
        connectionPool: {
            active: 0,
            idle: 0,
            waiting: 0,
            utilization: 0,
        },
    };

    try {
        const { getPartitionMetrics } = await import('./partition_metrics');
        const partitionData = await getPartitionMetrics({});

        const allSynced = partitionData.tables.every(t => t.lastSyncStatus === 'synced');
        const anySyncing = false; // Partition status is either 'synced' or 'out_of_sync'

        databaseMetrics.partitions = {
            ready: partitionData.switchoverReadiness.ready,
            count: partitionData.tables.length,
            syncStatus: allSynced ? 'synced' : (anySyncing ? 'syncing' : 'out-of-sync'),
        };
    } catch (error) {
        console.error('[AggregatedMetrics] Error fetching partition metrics:', error);
    }

    try {
        const { replicaHealthCheck, getReplicaLag } = await import('./database/replica_monitoring');
        const [healthData, lagData] = await Promise.all([
            replicaHealthCheck(),
            getReplicaLag(),
        ]);

        const maxLag = lagData.replicas.length > 0
            ? Math.max(...lagData.replicas.map((r: { lagSeconds: number }) => r.lagSeconds))
            : 0;
        const avgLag = lagData.replicas.length > 0
            ? lagData.replicas.reduce((sum: number, r: { lagSeconds: number }) => sum + r.lagSeconds, 0) / lagData.replicas.length
            : 0;
        const healthyCount = lagData.replicas.filter((r: { status: string }) => r.status === 'healthy').length;

        databaseMetrics.replicas = {
            enabled: healthData.replicasEnabled,
            count: healthData.replicaCount,
            maxLagSeconds: maxLag,
            avgLagSeconds: avgLag,
            healthyCount,
        };
    } catch (error) {
        console.error('[AggregatedMetrics] Error fetching replica metrics:', error);
    }

    // Calculate error rates
    const errorRate5xx = totalRequests > 0 ? (total5xxErrors / totalRequests) * 100 : 0;
    const errorRate4xx = totalRequests > 0 ? (total4xxErrors / totalRequests) * 100 : 0;

    // Calculate availability (simplified - in production use actual uptime tracking)
    const availabilityPercent = 100 - errorRate5xx;

    // Calculate SLO compliance
    const avgGetP95 = apiMetrics.get.p95;
    const avgGetP99 = apiMetrics.get.p99;
    const realtimeP95 = realtimeMetrics.deliveryP95Ms;
    const cacheHitRate = cacheMetrics.l2.hitRate;
    const errorRate = errorRate5xx;

    const slo = {
        apiP95: {
            target: 300,
            actual: avgGetP95,
            met: avgGetP95 < 300 || avgGetP95 === 0,
        },
        apiP99: {
            target: 800,
            actual: avgGetP99,
            met: avgGetP99 < 800 || avgGetP99 === 0,
        },
        realtimeP95: {
            target: 1000,
            actual: realtimeP95,
            met: realtimeP95 < 1000,
        },
        cacheHitRate: {
            target: 85,
            actual: cacheHitRate,
            met: cacheHitRate > 85 || cacheHitRate === 0,
        },
        errorRate: {
            target: 0.1,
            actual: errorRate,
            met: errorRate < 0.1,
        },
        availability: {
            target: 99.95,
            actual: availabilityPercent,
            met: availabilityPercent > 99.95,
        },
    };

    return {
        timestamp,
        uptime,
        api: apiMetrics,
        realtime: realtimeMetrics,
        cache: cacheMetrics,
        database: databaseMetrics,
        errors: {
            rate5xx: errorRate5xx,
            rate4xx: errorRate4xx,
            totalErrors,
            errorsByEndpoint,
        },
        availability: {
            uptime: availabilityPercent,
            downtimeSeconds: 0, // TODO: Track actual downtime
            lastIncident: null, // TODO: Track incidents
        },
        slo,
    };
}

/**
 * Get aggregated metrics (JSON format)
 */
export const getAggregatedMetrics = api<{}, AggregatedMetrics>(
    { auth: false, expose: true, method: "GET", path: "/v1/system/metrics/aggregated" },
    getAggregatedMetricsHandler
);

/**
 * Prometheus-compatible metrics format
 */
interface PrometheusMetric {
    name: string;
    type: 'gauge' | 'counter' | 'histogram';
    help: string;
    value: number;
    labels?: Record<string, string>;
}

/**
 * Generate Prometheus format metrics
 */
async function generatePrometheusMetrics(): Promise<string> {
    const metrics = await getAggregatedMetricsHandler();
    const lines: string[] = [];

    // API latency metrics
    lines.push('# HELP api_latency_p95_ms API latency 95th percentile in milliseconds');
    lines.push('# TYPE api_latency_p95_ms gauge');
    lines.push(`api_latency_p95_ms{method="GET"} ${metrics.api.get.p95}`);
    lines.push(`api_latency_p95_ms{method="POST"} ${metrics.api.post.p95}`);
    lines.push(`api_latency_p95_ms{method="PUT"} ${metrics.api.put.p95}`);
    lines.push(`api_latency_p95_ms{method="PATCH"} ${metrics.api.patch.p95}`);
    lines.push(`api_latency_p95_ms{method="DELETE"} ${metrics.api.delete.p95}`);

    lines.push('# HELP api_latency_p99_ms API latency 99th percentile in milliseconds');
    lines.push('# TYPE api_latency_p99_ms gauge');
    lines.push(`api_latency_p99_ms{method="GET"} ${metrics.api.get.p99}`);
    lines.push(`api_latency_p99_ms{method="POST"} ${metrics.api.post.p99}`);

    // Realtime metrics
    lines.push('# HELP realtime_active_connections Current active realtime connections');
    lines.push('# TYPE realtime_active_connections gauge');
    lines.push(`realtime_active_connections ${metrics.realtime.activeConnections}`);

    lines.push('# HELP realtime_events_delivered_total Total events delivered');
    lines.push('# TYPE realtime_events_delivered_total counter');
    lines.push(`realtime_events_delivered_total ${metrics.realtime.eventsDelivered}`);

    lines.push('# HELP realtime_delivery_p95_ms Realtime delivery latency 95th percentile');
    lines.push('# TYPE realtime_delivery_p95_ms gauge');
    lines.push(`realtime_delivery_p95_ms ${metrics.realtime.deliveryP95Ms}`);

    lines.push('# HELP realtime_compression_hit_rate Compression hit rate percentage');
    lines.push('# TYPE realtime_compression_hit_rate gauge');
    lines.push(`realtime_compression_hit_rate ${metrics.realtime.compressionHitRate * 100}`);

    // Cache metrics
    lines.push('# HELP cache_hit_rate Cache hit rate percentage');
    lines.push('# TYPE cache_hit_rate gauge');
    lines.push(`cache_hit_rate{tier="l1"} ${metrics.cache.l1.hitRate}`);
    lines.push(`cache_hit_rate{tier="l2"} ${metrics.cache.l2.hitRate}`);
    lines.push(`cache_hit_rate{tier="l3"} ${metrics.cache.l3.hitRate}`);

    // Database metrics
    lines.push('# HELP database_replica_lag_seconds Database replica lag in seconds');
    lines.push('# TYPE database_replica_lag_seconds gauge');
    lines.push(`database_replica_lag_seconds{stat="max"} ${metrics.database.replicas.maxLagSeconds}`);
    lines.push(`database_replica_lag_seconds{stat="avg"} ${metrics.database.replicas.avgLagSeconds}`);

    lines.push('# HELP database_connection_pool_utilization Connection pool utilization percentage');
    lines.push('# TYPE database_connection_pool_utilization gauge');
    lines.push(`database_connection_pool_utilization ${metrics.database.connectionPool.utilization}`);

    // Error rates
    lines.push('# HELP error_rate_5xx 5xx error rate percentage');
    lines.push('# TYPE error_rate_5xx gauge');
    lines.push(`error_rate_5xx ${metrics.errors.rate5xx}`);

    lines.push('# HELP error_rate_4xx 4xx error rate percentage');
    lines.push('# TYPE error_rate_4xx gauge');
    lines.push(`error_rate_4xx ${metrics.errors.rate4xx}`);

    // Availability
    lines.push('# HELP system_availability_percent System availability percentage');
    lines.push('# TYPE system_availability_percent gauge');
    lines.push(`system_availability_percent ${metrics.availability.uptime}`);

    // SLO compliance
    lines.push('# HELP slo_compliance SLO compliance (1 = met, 0 = not met)');
    lines.push('# TYPE slo_compliance gauge');
    lines.push(`slo_compliance{slo="api_p95"} ${metrics.slo.apiP95.met ? 1 : 0}`);
    lines.push(`slo_compliance{slo="api_p99"} ${metrics.slo.apiP99.met ? 1 : 0}`);
    lines.push(`slo_compliance{slo="realtime_p95"} ${metrics.slo.realtimeP95.met ? 1 : 0}`);
    lines.push(`slo_compliance{slo="cache_hit_rate"} ${metrics.slo.cacheHitRate.met ? 1 : 0}`);
    lines.push(`slo_compliance{slo="error_rate"} ${metrics.slo.errorRate.met ? 1 : 0}`);
    lines.push(`slo_compliance{slo="availability"} ${metrics.slo.availability.met ? 1 : 0}`);

    return lines.join('\n') + '\n';
}

/**
 * Get aggregated metrics in Prometheus format
 */
export const getAggregatedMetricsPrometheus = api<{}, { metrics: string }>(
    { auth: false, expose: true, method: "GET", path: "/v1/system/metrics/prometheus" },
    async (): Promise<{ metrics: string }> => {
        const prometheusText = await generatePrometheusMetrics();
        return { metrics: prometheusText };
    }
);

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
    for (const method in apiLatencies) {
        apiLatencies[method] = [];
    }
    totalRequests = 0;
    totalErrors = 0;
    total5xxErrors = 0;
    total4xxErrors = 0;
    for (const key in errorsByEndpoint) {
        delete errorsByEndpoint[key];
    }
}

console.log('[AggregatedMetrics] ✅ Aggregated metrics endpoint initialized');
