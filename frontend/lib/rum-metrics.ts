/**
 * Real User Monitoring (RUM) Metrics
 * 
 * Captures frontend performance metrics for baseline measurement:
 * - Navigation Timing API data (TTFB, responseStart, transferSize)
 * - Fetch performance for API calls
 * - Samples at 5% and sends to telemetry endpoint
 */

// Sample rate (5% of requests)
const SAMPLE_RATE = 0.05;

// Batch size before sending
const BATCH_SIZE = 10;

// Max batch age before flush (30 seconds)
const MAX_BATCH_AGE_MS = 30_000;

// Telemetry endpoint
const TELEMETRY_ENDPOINT = '/v1/system/telemetry/client';

/**
 * RUM metric types
 */
export interface NavigationMetric {
  type: 'navigation';
  url: string;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  transferSizeBytes: number;
  encodedBodySizeBytes: number;
  decodedBodySizeBytes: number;
  timestamp: string;
}

export interface FetchMetric {
  type: 'fetch';
  url: string;
  method: string;
  ttfbMs: number;
  durationMs: number;
  transferSizeBytes: number;
  statusCode: number;
  cached: boolean;
  compressed: boolean;
  was304: boolean;
  timestamp: string;
}

export interface ErrorMetric {
  type: 'fetch_error';
  url: string;
  method: string;
  errorType: 'network' | 'timeout' | 'abort' | 'unknown';
  durationMs: number;
  timestamp: string;
}

export type RUMMetric = NavigationMetric | FetchMetric | ErrorMetric;

/**
 * Metrics batch for sending to telemetry
 */
interface MetricsBatch {
  metrics: RUMMetric[];
  createdAt: number;
}

// Current batch
let currentBatch: MetricsBatch = {
  metrics: [],
  createdAt: Date.now(),
};

// Flush timer
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Should this request be sampled?
 */
function shouldSample(): boolean {
  return Math.random() < SAMPLE_RATE;
}

/**
 * Add metric to batch and maybe flush
 */
function addMetric(metric: RUMMetric): void {
  currentBatch.metrics.push(metric);

  // Schedule flush if needed
  if (currentBatch.metrics.length >= BATCH_SIZE) {
    flushMetrics();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushMetrics, MAX_BATCH_AGE_MS);
  }
}

/**
 * Flush metrics batch to telemetry endpoint
 */
async function flushMetrics(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (currentBatch.metrics.length === 0) return;

  const batchToSend = currentBatch;
  currentBatch = {
    metrics: [],
    createdAt: Date.now(),
  };

  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Skip if not authenticated
      return;
    }

    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        events: batchToSend.metrics.map(m => ({
          type: 'rum_metric',
          data: m,
          ts: m.timestamp,
        })),
        sampleRate: SAMPLE_RATE,
      }),
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    console.debug('[RUM] Failed to send metrics:', error);
  }
}

/**
 * Capture navigation timing metrics
 */
export function captureNavigationMetrics(): void {
  if (!shouldSample()) return;

  // Wait for load event to complete
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => captureNavigationMetrics(), { once: true });
    return;
  }

  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const metric: NavigationMetric = {
      type: 'navigation',
      url: window.location.pathname,
      ttfbMs: navigation.responseStart - navigation.requestStart,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      transferSizeBytes: navigation.transferSize || 0,
      encodedBodySizeBytes: navigation.encodedBodySize || 0,
      decodedBodySizeBytes: navigation.decodedBodySize || 0,
      timestamp: new Date().toISOString(),
    };

    addMetric(metric);
  } catch (error) {
    console.debug('[RUM] Failed to capture navigation metrics:', error);
  }
}

/**
 * Capture fetch performance metrics
 */
export function captureFetchMetrics(
  url: string,
  method: string,
  startTime: number,
  response: Response,
  bodySize: number
): void {
  if (!shouldSample()) return;

  try {
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    // Try to get resource timing for more accurate TTFB
    let ttfbMs = durationMs; // fallback
    const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
    if (entries.length > 0) {
      const entry = entries[entries.length - 1];
      ttfbMs = entry.responseStart - entry.requestStart;
    }

    const metric: FetchMetric = {
      type: 'fetch',
      url: new URL(url, window.location.origin).pathname,
      method,
      ttfbMs,
      durationMs,
      transferSizeBytes: bodySize,
      statusCode: response.status,
      cached: response.headers.get('X-Cache') === 'HIT',
      compressed: !!response.headers.get('Content-Encoding'),
      was304: response.status === 304,
      timestamp: new Date().toISOString(),
    };

    addMetric(metric);
  } catch (error) {
    console.debug('[RUM] Failed to capture fetch metrics:', error);
  }
}

/**
 * Capture fetch error metrics
 */
export function captureFetchError(
  url: string,
  method: string,
  startTime: number,
  error: unknown
): void {
  if (!shouldSample()) return;

  try {
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    let errorType: ErrorMetric['errorType'] = 'unknown';
    if (error instanceof TypeError && error.message.includes('network')) {
      errorType = 'network';
    } else if (error instanceof DOMException) {
      if (error.name === 'AbortError') {
        errorType = 'abort';
      } else if (error.name === 'TimeoutError') {
        errorType = 'timeout';
      }
    }

    const metric: ErrorMetric = {
      type: 'fetch_error',
      url: new URL(url, window.location.origin).pathname,
      method,
      errorType,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    addMetric(metric);
  } catch (err) {
    console.debug('[RUM] Failed to capture error metrics:', err);
  }
}

/**
 * Create a fetch wrapper that captures metrics
 */
export function createInstrumentedFetch(originalFetch: typeof fetch): typeof fetch {
  return async function instrumentedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    const startTime = performance.now();

    // Add X-Request-Start header for server-side correlation
    const headers = new Headers(init?.headers);
    headers.set('X-Request-Start', String(Date.now()));

    try {
      const response = await originalFetch(input, { ...init, headers });

      // Clone response to read body size without consuming it
      const clonedResponse = response.clone();
      let bodySize = 0;

      try {
        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
          bodySize = parseInt(contentLength, 10);
        } else {
          // Read body to get size (only for sampled requests)
          if (shouldSample()) {
            const blob = await clonedResponse.blob();
            bodySize = blob.size;
          }
        }
      } catch {
        // Ignore body size errors
      }

      captureFetchMetrics(url, method, startTime, response, bodySize);

      return response;
    } catch (error) {
      captureFetchError(url, method, startTime, error);
      throw error;
    }
  };
}

/**
 * Initialize RUM collection
 * Call this once at app startup
 */
export function initRUM(): void {
  // Capture initial navigation metrics
  captureNavigationMetrics();

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushMetrics();
  });

  // Flush on visibility change (tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushMetrics();
    }
  });

  console.debug('[RUM] Initialized with sample rate:', SAMPLE_RATE);
}

/**
 * Web Vitals collection (optional, for more detailed metrics)
 */
export function captureWebVital(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor'): void {
  if (!shouldSample()) return;

  const metric = {
    type: 'web_vital' as const,
    name,
    value,
    rating,
    url: window.location.pathname,
    timestamp: new Date().toISOString(),
  };

  addMetric(metric as unknown as RUMMetric);
}

/**
 * Force flush (for testing)
 */
export function forceFlush(): Promise<void> {
  return flushMetrics();
}

/**
 * Get current batch size (for testing)
 */
export function getCurrentBatchSize(): number {
  return currentBatch.metrics.length;
}

