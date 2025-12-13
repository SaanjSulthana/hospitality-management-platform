/**
 * Response Metrics
 * 
 * Utilities for tracking response timing and adding Server-Timing headers.
 * Integrates with the metrics aggregator for baseline capture.
 */

import { recordMetric, getEndpointFamily, type EndpointFamily } from './metrics_aggregator';

/**
 * Response wrapper with timing and metrics
 */
export interface ResponseMetadata {
  path: string;
  startTime: number;
  statusCode: number;
  payloadBytes: number;
  compressed: boolean;
  compressionRatio?: number;
  was304: boolean;
  etagHit: boolean;
  serverTimingHeader: string;
}

/**
 * Create a request timer context
 */
export function createRequestTimer(path: string): RequestTimer {
  return new RequestTimer(path);
}

/**
 * Request timer class for tracking request lifecycle
 */
export class RequestTimer {
  private startTime: number;
  private path: string;
  private family: EndpointFamily;
  private checkpoints: Map<string, number> = new Map();
  
  constructor(path: string) {
    this.startTime = performance.now();
    this.path = path;
    this.family = getEndpointFamily(path);
  }
  
  /**
   * Mark a checkpoint (e.g., 'db', 'cache', 'serialize')
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, performance.now() - this.startTime);
  }
  
  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMs(): number {
    return performance.now() - this.startTime;
  }
  
  /**
   * Finalize the request and record metrics
   */
  finalize(
    statusCode: number,
    payloadBytes: number,
    options: {
      compressed?: boolean;
      compressionRatio?: number;
      was304?: boolean;
      etagHit?: boolean;
    } = {}
  ): ResponseMetadata {
    const ttfbMs = this.getElapsedMs();
    const {
      compressed = false,
      compressionRatio,
      was304 = false,
      etagHit = false,
    } = options;
    
    // Record to aggregator
    recordMetric(
      this.path,
      ttfbMs,
      payloadBytes,
      statusCode,
      compressed,
      compressionRatio,
      was304,
      etagHit
    );
    
    // Build Server-Timing header
    const serverTimingHeader = this.buildServerTimingHeader(ttfbMs);
    
    return {
      path: this.path,
      startTime: this.startTime,
      statusCode,
      payloadBytes,
      compressed,
      compressionRatio,
      was304,
      etagHit,
      serverTimingHeader,
    };
  }
  
  /**
   * Build Server-Timing header value
   * Format: total;dur=X, db;dur=Y, cache;dur=Z
   */
  private buildServerTimingHeader(totalMs: number): string {
    const parts: string[] = [];
    
    // Add total duration
    parts.push(`total;dur=${totalMs.toFixed(2)}`);
    
    // Add checkpoints
    for (const [name, durationMs] of this.checkpoints.entries()) {
      parts.push(`${name};dur=${durationMs.toFixed(2)}`);
    }
    
    return parts.join(', ');
  }
}

/**
 * Wrapper function to add Server-Timing and metrics to any endpoint
 * 
 * Usage:
 * ```typescript
 * export const myEndpoint = api(
 *   { method: "GET", path: "/my/path" },
 *   async (req) => withMetrics("/my/path", async (timer) => {
 *     timer.checkpoint('db');
 *     const data = await fetchData();
 *     timer.checkpoint('serialize');
 *     return { data };
 *   })
 * );
 * ```
 */
export async function withMetrics<T>(
  path: string,
  handler: (timer: RequestTimer) => Promise<T>
): Promise<{ data: T; _metadata: ResponseMetadata }> {
  const timer = createRequestTimer(path);
  
  try {
    const data = await handler(timer);
    
    // Estimate payload size (JSON serialization)
    const payloadBytes = estimatePayloadSize(data);
    
    const metadata = timer.finalize(200, payloadBytes);
    
    // Note: In Encore, we can't directly set headers on the response
    // The metadata is returned for logging/debugging purposes
    // For actual header setting, we'd need to use raw HTTP handlers
    
    return { data, _metadata: metadata };
  } catch (error) {
    const metadata = timer.finalize(500, 0);
    console.error('[ResponseMetrics][error]', {
      path,
      ttfbMs: metadata.serverTimingHeader,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Simple wrapper for tracking metrics without modifying response structure
 * Records timing but doesn't wrap the response
 */
export async function trackMetrics<T>(
  path: string,
  handler: (timer: RequestTimer) => Promise<T>
): Promise<T> {
  const timer = createRequestTimer(path);
  
  try {
    const result = await handler(timer);
    const payloadBytes = estimatePayloadSize(result);
    const metadata = timer.finalize(200, payloadBytes);
    
    // Log Server-Timing for debugging/monitoring
    console.log('[ResponseMetrics][timing]', {
      path,
      family: getEndpointFamily(path),
      ttfbMs: timer.getElapsedMs().toFixed(2),
      payloadBytes,
      serverTiming: metadata.serverTimingHeader,
    });
    
    return result;
  } catch (error) {
    timer.finalize(500, 0);
    throw error;
  }
}

/**
 * Estimate payload size in bytes
 */
function estimatePayloadSize(data: unknown): number {
  if (data === null || data === undefined) return 0;
  
  try {
    const json = JSON.stringify(data);
    // Return byte length (UTF-8)
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

/**
 * Manual metric recording for cases where the wrapper can't be used
 */
export function recordRequestMetric(
  path: string,
  ttfbMs: number,
  payloadBytes: number,
  statusCode: number = 200,
  options: {
    compressed?: boolean;
    compressionRatio?: number;
    was304?: boolean;
    etagHit?: boolean;
  } = {}
): void {
  recordMetric(
    path,
    ttfbMs,
    payloadBytes,
    statusCode,
    options.compressed ?? false,
    options.compressionRatio,
    options.was304 ?? false,
    options.etagHit ?? false
  );
}

/**
 * Get X-Request-ID header value or generate one
 */
export function getOrCreateRequestId(existingId?: string): string {
  if (existingId) return existingId;
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

