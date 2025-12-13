/**
 * Networking Optimizations Wrapper
 * 
 * Combines all middleware features into a single easy-to-use wrapper
 * for applying to endpoints.
 */

import { createRequestTimer, type RequestTimer } from './response_metrics';
import { compressResponse, recordCompressionStats, type CompressionResult } from './compression';
import { checkConditionalGetFromData, recordETagCheck, type ConditionalResponse } from './etag';
import { validateIfModifiedSince, type LastModifiedValidation, type EntityType } from './last_modified';
import { generateCacheHeaders, type SurrogateKeyContext, type CacheHeaders } from './cache_headers';
import { recordMetric } from './metrics_aggregator';

/**
 * Options for networking optimizations
 */
export interface NetworkingOptions {
  /**
   * Request path (for metrics and cache policy)
   */
  path: string;
  
  /**
   * Accept-Encoding header value
   */
  acceptEncoding?: string;
  
  /**
   * If-None-Match header value (for ETag validation)
   */
  ifNoneMatch?: string;
  
  /**
   * If-Modified-Since header value
   */
  ifModifiedSince?: string;
  
  /**
   * Organization ID (for cache keys and Last-Modified)
   */
  orgId?: number;
  
  /**
   * Property ID (for cache keys)
   */
  propertyId?: number;
  
  /**
   * User ID (for cache keys)
   */
  userId?: number;
  
  /**
   * Entity type for Last-Modified tracking
   */
  entityType?: EntityType;
  
  /**
   * Entity ID for Last-Modified tracking
   */
  entityId?: string | number;
  
  /**
   * Additional surrogate key context
   */
  surrogateContext?: Partial<SurrogateKeyContext>;
  
  /**
   * Whether to enable compression (default: true)
   */
  enableCompression?: boolean;
  
  /**
   * Whether to enable ETag validation (default: true)
   */
  enableETag?: boolean;
  
  /**
   * Whether to enable caching headers (default: true)
   */
  enableCaching?: boolean;
  
  /**
   * Custom Last-Modified date (overrides automatic lookup)
   */
  lastModified?: Date;
}

/**
 * Optimized response with all headers and metadata
 */
export interface OptimizedResponse<T> {
  /**
   * Response data (may be compressed Buffer or original data)
   */
  data: T | Buffer;
  
  /**
   * Whether to return 304 Not Modified
   */
  is304: boolean;
  
  /**
   * All headers to set on the response
   */
  headers: Record<string, string>;
  
  /**
   * Compression result (if applicable)
   */
  compression?: CompressionResult;
  
  /**
   * ETag validation result
   */
  etag?: ConditionalResponse;
  
  /**
   * Last-Modified validation result
   */
  lastModified?: LastModifiedValidation;
  
  /**
   * Request timing metadata
   */
  timing: {
    ttfbMs: number;
    serverTiming: string;
  };
}

/**
 * Apply networking optimizations to a response
 * 
 * Usage:
 * ```typescript
 * const handler = async (req) => {
 *   return withNetworkingOptimizations(
 *     { path: '/v1/reports/daily-report', orgId: auth.orgId, ... },
 *     async (timer) => {
 *       timer.checkpoint('db');
 *       const data = await fetchData();
 *       return data;
 *     }
 *   );
 * };
 * ```
 */
export async function withNetworkingOptimizations<T>(
  options: NetworkingOptions,
  handler: (timer: RequestTimer) => Promise<T>
): Promise<OptimizedResponse<T>> {
  const {
    path,
    acceptEncoding,
    ifNoneMatch,
    ifModifiedSince,
    orgId,
    propertyId,
    userId,
    entityType,
    entityId,
    surrogateContext = {},
    enableCompression = true,
    enableETag = true,
    enableCaching = true,
    lastModified: customLastModified,
  } = options;
  
  const timer = createRequestTimer(path);
  const headers: Record<string, string> = {};
  
  // Execute handler
  let data: T;
  try {
    data = await handler(timer);
  } catch (error) {
    const ttfbMs = timer.getElapsedMs();
    recordMetric(path, ttfbMs, 0, 500, false, undefined, false, false);
    throw error;
  }
  
  const ttfbMs = timer.getElapsedMs();
  
  // Check conditional GET (ETag)
  let etagResult: ConditionalResponse | undefined;
  let is304 = false;
  
  if (enableETag && data !== null && data !== undefined) {
    etagResult = checkConditionalGetFromData(
      data as unknown as object,
      ifNoneMatch,
      ifModifiedSince,
      customLastModified
    );
    
    Object.assign(headers, etagResult.headers);
    recordETagCheck(etagResult.should304);
    
    if (etagResult.should304) {
      is304 = true;
    }
  }
  
  // Check Last-Modified (if ETag didn't match)
  let lastModifiedValidation: LastModifiedValidation | undefined;
  
  if (!is304 && ifModifiedSince && orgId && entityType) {
    lastModifiedValidation = validateIfModifiedSince(
      orgId,
      entityType,
      ifModifiedSince,
      entityId
    );
    
    if (lastModifiedValidation.lastModifiedHeader) {
      headers['Last-Modified'] = lastModifiedValidation.lastModifiedHeader;
    }
    
    if (lastModifiedValidation.shouldReturn304) {
      is304 = true;
    }
  }
  
  // If 304, return early with minimal response
  if (is304) {
    const serverTiming = `total;dur=${ttfbMs.toFixed(2)}, 304;desc="Not Modified"`;
    headers['Server-Timing'] = serverTiming;
    
    recordMetric(path, ttfbMs, 0, 304, false, undefined, true, !!etag?.should304);
    
    return {
      data: data,
      is304: true,
      headers,
      etag,
      lastModified: lastModifiedValidation,
      timing: {
        ttfbMs,
        serverTiming,
      },
    };
  }
  
  // Add cache headers
  if (enableCaching) {
    const cacheContext: SurrogateKeyContext = {
      orgId,
      propertyId,
      userId,
      ...surrogateContext,
    };
    
    const cacheHeaders = generateCacheHeaders(path, cacheContext);
    Object.assign(headers, cacheHeaders);
  }
  
  // Compress response
  let compression: CompressionResult | undefined;
  let responseData: T | Buffer = data;
  
  if (enableCompression && data !== null && data !== undefined) {
    compression = compressResponse(data as unknown as object, acceptEncoding);
    recordCompressionStats(compression);
    
    if (compression.wasCompressed) {
      responseData = compression.data;
      headers['Content-Encoding'] = compression.encoding;
      headers['Content-Length'] = String(compression.compressedSize);
      headers['X-Original-Size'] = String(compression.originalSize);
    }
  }
  
  // Build Server-Timing header
  const serverTimingParts = [`total;dur=${ttfbMs.toFixed(2)}`];
  if (compression?.wasCompressed) {
    serverTimingParts.push(`compress;dur=0;ratio=${compression.compressionRatio.toFixed(3)}`);
  }
  const serverTiming = serverTimingParts.join(', ');
  headers['Server-Timing'] = serverTiming;
  
  // Record metrics
  const payloadBytes = compression?.compressedSize ?? estimateSize(data);
  recordMetric(
    path,
    ttfbMs,
    payloadBytes,
    200,
    compression?.wasCompressed ?? false,
    compression?.compressionRatio,
    false,
    false
  );
  
  return {
    data: responseData,
    is304: false,
    headers,
    compression,
    etag,
    lastModified: lastModifiedValidation,
    timing: {
      ttfbMs,
      serverTiming,
    },
  };
}

/**
 * Estimate size of data in bytes
 */
function estimateSize(data: unknown): number {
  if (data === null || data === undefined) return 0;
  if (Buffer.isBuffer(data)) return data.length;
  
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf-8');
  } catch {
    return 0;
  }
}

/**
 * Simplified wrapper for endpoints that just need metrics tracking
 */
export async function withMetricsOnly<T>(
  path: string,
  handler: (timer: RequestTimer) => Promise<T>
): Promise<{ data: T; serverTiming: string }> {
  const timer = createRequestTimer(path);
  
  try {
    const data = await handler(timer);
    const ttfbMs = timer.getElapsedMs();
    const payloadBytes = estimateSize(data);
    
    recordMetric(path, ttfbMs, payloadBytes, 200, false, undefined, false, false);
    
    const serverTiming = `total;dur=${ttfbMs.toFixed(2)}`;
    
    return { data, serverTiming };
  } catch (error) {
    const ttfbMs = timer.getElapsedMs();
    recordMetric(path, ttfbMs, 0, 500, false, undefined, false, false);
    throw error;
  }
}

