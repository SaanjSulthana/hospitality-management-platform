/**
 * Metrics Aggregator
 * 
 * In-memory metrics storage with sliding window for baseline capture.
 * Tracks: p50/p95/p99 TTFB, payload size distribution, request counts by endpoint family.
 */

// Sliding window duration (5 minutes)
const WINDOW_MS = 5 * 60 * 1000;

// Cleanup interval (1 minute)
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Max samples per endpoint family to prevent memory bloat
const MAX_SAMPLES_PER_FAMILY = 10000;

/**
 * Single request metric sample
 */
interface MetricSample {
  timestamp: number;
  ttfbMs: number;
  payloadBytes: number;
  statusCode: number;
  compressed: boolean;
  compressionRatio?: number;
  was304: boolean;
  etagHit: boolean;
}

/**
 * Endpoint family categories for aggregation
 */
export type EndpointFamily = 
  | 'reports'
  | 'finance'
  | 'analytics'
  | 'properties'
  | 'branding'
  | 'users'
  | 'staff'
  | 'tasks'
  | 'guest-checkin'
  | 'realtime'
  | 'monitoring'
  | 'auth'
  | 'other';

/**
 * Aggregated metrics for an endpoint family
 */
export interface AggregatedMetrics {
  family: EndpointFamily;
  sampleCount: number;
  windowStartMs: number;
  windowEndMs: number;
  ttfb: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  payloadBytes: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  statusCodes: Record<number, number>;
  compressionStats: {
    compressedCount: number;
    uncompressedCount: number;
    avgCompressionRatio: number;
  };
  conditionalGetStats: {
    total304: number;
    etagHits: number;
    ratio304: number;
  };
}

/**
 * Global metrics summary
 */
export interface MetricsSummary {
  timestamp: string;
  windowDurationMs: number;
  totalRequests: number;
  byFamily: AggregatedMetrics[];
  overall: {
    ttfb: { p50: number; p95: number; p99: number; avg: number };
    payloadBytes: { p50: number; p95: number; p99: number; avg: number };
    compressionRatio: number;
    ratio304: number;
  };
}

/**
 * Metrics storage per endpoint family
 */
const metricsStore = new Map<EndpointFamily, MetricSample[]>();

/**
 * Determine endpoint family from path
 */
export function getEndpointFamily(path: string): EndpointFamily {
  const normalized = path.toLowerCase();
  
  if (normalized.includes('/reports')) return 'reports';
  if (normalized.includes('/finance')) return 'finance';
  if (normalized.includes('/analytics')) return 'analytics';
  if (normalized.includes('/properties')) return 'properties';
  if (normalized.includes('/branding')) return 'branding';
  if (normalized.includes('/users')) return 'users';
  if (normalized.includes('/staff')) return 'staff';
  if (normalized.includes('/tasks')) return 'tasks';
  if (normalized.includes('/guest-checkin') || normalized.includes('/checkin')) return 'guest-checkin';
  if (normalized.includes('/realtime') || normalized.includes('/stream')) return 'realtime';
  if (normalized.includes('/monitoring') || normalized.includes('/health')) return 'monitoring';
  if (normalized.includes('/auth') || normalized.includes('/login') || normalized.includes('/logout')) return 'auth';
  
  return 'other';
}

/**
 * Record a metric sample
 */
export function recordMetric(
  path: string,
  ttfbMs: number,
  payloadBytes: number,
  statusCode: number,
  compressed: boolean = false,
  compressionRatio?: number,
  was304: boolean = false,
  etagHit: boolean = false
): void {
  const family = getEndpointFamily(path);
  
  if (!metricsStore.has(family)) {
    metricsStore.set(family, []);
  }
  
  const samples = metricsStore.get(family)!;
  
  // Add sample
  samples.push({
    timestamp: Date.now(),
    ttfbMs,
    payloadBytes,
    statusCode,
    compressed,
    compressionRatio,
    was304,
    etagHit,
  });
  
  // Enforce max samples (remove oldest)
  if (samples.length > MAX_SAMPLES_PER_FAMILY) {
    samples.splice(0, samples.length - MAX_SAMPLES_PER_FAMILY);
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

/**
 * Get aggregated metrics for a family within the time window
 */
function aggregateFamily(family: EndpointFamily, windowStartMs: number): AggregatedMetrics {
  const samples = metricsStore.get(family) || [];
  const windowSamples = samples.filter(s => s.timestamp >= windowStartMs);
  
  const ttfbValues = windowSamples.map(s => s.ttfbMs).sort((a, b) => a - b);
  const payloadValues = windowSamples.map(s => s.payloadBytes).sort((a, b) => a - b);
  
  const statusCodes: Record<number, number> = {};
  let compressedCount = 0;
  let uncompressedCount = 0;
  let totalCompressionRatio = 0;
  let compressionRatioCount = 0;
  let total304 = 0;
  let etagHits = 0;
  
  for (const sample of windowSamples) {
    statusCodes[sample.statusCode] = (statusCodes[sample.statusCode] || 0) + 1;
    
    if (sample.compressed) {
      compressedCount++;
      if (sample.compressionRatio !== undefined) {
        totalCompressionRatio += sample.compressionRatio;
        compressionRatioCount++;
      }
    } else {
      uncompressedCount++;
    }
    
    if (sample.was304) total304++;
    if (sample.etagHit) etagHits++;
  }
  
  const now = Date.now();
  
  return {
    family,
    sampleCount: windowSamples.length,
    windowStartMs,
    windowEndMs: now,
    ttfb: {
      p50: percentile(ttfbValues, 50),
      p95: percentile(ttfbValues, 95),
      p99: percentile(ttfbValues, 99),
      avg: ttfbValues.length > 0 ? ttfbValues.reduce((a, b) => a + b, 0) / ttfbValues.length : 0,
      min: ttfbValues.length > 0 ? ttfbValues[0] : 0,
      max: ttfbValues.length > 0 ? ttfbValues[ttfbValues.length - 1] : 0,
    },
    payloadBytes: {
      p50: percentile(payloadValues, 50),
      p95: percentile(payloadValues, 95),
      p99: percentile(payloadValues, 99),
      avg: payloadValues.length > 0 ? payloadValues.reduce((a, b) => a + b, 0) / payloadValues.length : 0,
      min: payloadValues.length > 0 ? payloadValues[0] : 0,
      max: payloadValues.length > 0 ? payloadValues[payloadValues.length - 1] : 0,
    },
    statusCodes,
    compressionStats: {
      compressedCount,
      uncompressedCount,
      avgCompressionRatio: compressionRatioCount > 0 ? totalCompressionRatio / compressionRatioCount : 0,
    },
    conditionalGetStats: {
      total304,
      etagHits,
      ratio304: windowSamples.length > 0 ? total304 / windowSamples.length : 0,
    },
  };
}

/**
 * Get complete metrics summary
 */
export function getMetricsSummary(): MetricsSummary {
  const now = Date.now();
  const windowStartMs = now - WINDOW_MS;
  
  const families: EndpointFamily[] = [
    'reports', 'finance', 'analytics', 'properties', 'branding',
    'users', 'staff', 'tasks', 'guest-checkin', 'realtime',
    'monitoring', 'auth', 'other'
  ];
  
  const byFamily = families
    .map(f => aggregateFamily(f, windowStartMs))
    .filter(m => m.sampleCount > 0);
  
  // Calculate overall metrics
  const allTtfb: number[] = [];
  const allPayload: number[] = [];
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let total304 = 0;
  let totalRequests = 0;
  let totalCompressionRatio = 0;
  let compressionRatioCount = 0;
  
  for (const family of byFamily) {
    totalRequests += family.sampleCount;
    totalCompressed += family.compressionStats.compressedCount;
    totalUncompressed += family.compressionStats.uncompressedCount;
    total304 += family.conditionalGetStats.total304;
    
    if (family.compressionStats.avgCompressionRatio > 0) {
      totalCompressionRatio += family.compressionStats.avgCompressionRatio * family.compressionStats.compressedCount;
      compressionRatioCount += family.compressionStats.compressedCount;
    }
    
    // Collect samples for overall percentiles
    const samples = metricsStore.get(family.family) || [];
    for (const s of samples) {
      if (s.timestamp >= windowStartMs) {
        allTtfb.push(s.ttfbMs);
        allPayload.push(s.payloadBytes);
      }
    }
  }
  
  allTtfb.sort((a, b) => a - b);
  allPayload.sort((a, b) => a - b);
  
  return {
    timestamp: new Date().toISOString(),
    windowDurationMs: WINDOW_MS,
    totalRequests,
    byFamily,
    overall: {
      ttfb: {
        p50: percentile(allTtfb, 50),
        p95: percentile(allTtfb, 95),
        p99: percentile(allTtfb, 99),
        avg: allTtfb.length > 0 ? allTtfb.reduce((a, b) => a + b, 0) / allTtfb.length : 0,
      },
      payloadBytes: {
        p50: percentile(allPayload, 50),
        p95: percentile(allPayload, 95),
        p99: percentile(allPayload, 99),
        avg: allPayload.length > 0 ? allPayload.reduce((a, b) => a + b, 0) / allPayload.length : 0,
      },
      compressionRatio: compressionRatioCount > 0 ? totalCompressionRatio / compressionRatioCount : 0,
      ratio304: totalRequests > 0 ? total304 / totalRequests : 0,
    },
  };
}

/**
 * Cleanup old samples outside the window
 */
function cleanupOldSamples(): void {
  const cutoff = Date.now() - WINDOW_MS;
  
  for (const [family, samples] of metricsStore.entries()) {
    const filtered = samples.filter(s => s.timestamp >= cutoff);
    if (filtered.length === 0) {
      metricsStore.delete(family);
    } else {
      metricsStore.set(family, filtered);
    }
  }
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  metricsStore.clear();
}

/**
 * Get raw sample count (for testing/debugging)
 */
export function getSampleCount(): number {
  let total = 0;
  for (const samples of metricsStore.values()) {
    total += samples.length;
  }
  return total;
}

// Start periodic cleanup
setInterval(cleanupOldSamples, CLEANUP_INTERVAL_MS);

// Log metrics summary periodically (every 5 minutes) for baseline capture
setInterval(() => {
  const summary = getMetricsSummary();
  if (summary.totalRequests > 0) {
    console.log('[MetricsAggregator][summary]', JSON.stringify({
      timestamp: summary.timestamp,
      totalRequests: summary.totalRequests,
      overall: summary.overall,
      familyCount: summary.byFamily.length,
    }));
  }
}, WINDOW_MS);

