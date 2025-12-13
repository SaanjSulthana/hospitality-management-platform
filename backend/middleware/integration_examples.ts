/**
 * Middleware Integration Examples
 * 
 * This file demonstrates how to integrate networking optimizations
 * into existing endpoints. Use these patterns when updating services.
 */

import { api, APIError, Header } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import {
  withNetworkingOptimizations,
  withMetricsOnly,
  createRequestTimer,
  generateCacheHeaders,
  generateETag,
  checkConditionalGetFromData,
  compressResponse,
  recordMetric,
  updateLastModified,
} from './index';

// ============================================================================
// EXAMPLE 1: Full optimization wrapper for a GET endpoint
// ============================================================================

/**
 * Example request type with conditional GET headers
 */
interface OptimizedGetRequest {
  propertyId?: number;
  // Conditional GET headers (passed from client)
  ifNoneMatch?: Header<"If-None-Match">;
  ifModifiedSince?: Header<"If-Modified-Since">;
  acceptEncoding?: Header<"Accept-Encoding">;
}

interface ExampleResponse {
  data: unknown;
  // Note: Headers can't be directly set in Encore responses,
  // but they're returned for logging and future raw HTTP handler use
  _cacheHeaders?: Record<string, string>;
}

/**
 * Example: Optimized GET endpoint with all features
 * 
 * This shows the recommended pattern for high-traffic GET endpoints.
 */
export const exampleOptimizedGet = api<OptimizedGetRequest, ExampleResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/example/optimized" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const result = await withNetworkingOptimizations(
      {
        path: "/v1/example/optimized",
        acceptEncoding: req.acceptEncoding,
        ifNoneMatch: req.ifNoneMatch,
        ifModifiedSince: req.ifModifiedSince,
        orgId: authData.orgId,
        propertyId: req.propertyId,
        entityType: 'properties', // For Last-Modified tracking
        enableCompression: true,
        enableETag: true,
        enableCaching: true,
      },
      async (timer) => {
        // Your existing handler logic here
        timer.checkpoint('db');
        
        // Simulated data fetch
        const data = { 
          items: [{ id: 1, name: "Example" }],
          count: 1,
        };
        
        timer.checkpoint('serialize');
        return data;
      }
    );

    // If 304, return minimal response (client uses cached version)
    if (result.is304) {
      // In a raw HTTP handler, you'd return 304 status here
      // With Encore, the client should check the ETag header
      console.log('[Example] 304 Not Modified, client should use cache');
    }

    return {
      data: result.data,
      _cacheHeaders: result.headers,
    };
  }
);

// ============================================================================
// EXAMPLE 2: Metrics-only wrapper (for endpoints that don't need caching)
// ============================================================================

interface MetricsOnlyRequest {
  id: number;
}

/**
 * Example: Endpoint with just metrics tracking
 * 
 * Use this for write endpoints or user-specific data that shouldn't be cached.
 */
export const exampleMetricsOnly = api<MetricsOnlyRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/v1/example/metrics-only" },
  async (req) => {
    const { data, serverTiming } = await withMetricsOnly(
      "/v1/example/metrics-only",
      async (timer) => {
        timer.checkpoint('validate');
        // Validation logic...
        
        timer.checkpoint('db');
        // Database write...
        
        return { success: true };
      }
    );

    console.log('[Example] Server-Timing:', serverTiming);
    return data;
  }
);

// ============================================================================
// EXAMPLE 3: Manual integration (for complex endpoints)
// ============================================================================

interface ManualIntegrationRequest {
  propertyId: number;
  date: string;
  ifNoneMatch?: Header<"If-None-Match">;
  acceptEncoding?: Header<"Accept-Encoding">;
}

interface ManualIntegrationResponse {
  items: unknown[];
  timestamp: string;
  _is304?: boolean;
  _headers?: Record<string, string>;
}

/**
 * Example: Manual integration for complex scenarios
 * 
 * Use this pattern when you need fine-grained control over each step.
 */
export const exampleManualIntegration = api<ManualIntegrationRequest, ManualIntegrationResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/example/manual" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const timer = createRequestTimer("/v1/example/manual");
    
    try {
      // Step 1: Fetch data
      timer.checkpoint('db');
      const data = { items: [], timestamp: new Date().toISOString() };
      
      // Step 2: Check conditional GET (ETag)
      timer.checkpoint('etag');
      const conditionalResult = checkConditionalGetFromData(
        data,
        req.ifNoneMatch,
        undefined,
        new Date() // Last modified date
      );
      
      if (conditionalResult.should304) {
        // Record 304 metric
        const ttfbMs = timer.getElapsedMs();
        recordMetric("/v1/example/manual", ttfbMs, 0, 304, false, undefined, true, true);
        
        // Return with 304 indicator (actual status code depends on HTTP layer)
        return {
          items: [],
          timestamp: new Date().toISOString(),
          _is304: true,
          _headers: conditionalResult.headers,
        };
      }
      
      // Step 3: Compress response
      timer.checkpoint('compress');
      const compression = compressResponse(data, req.acceptEncoding);
      
      // Step 4: Generate cache headers
      const cacheHeaders = generateCacheHeaders("/v1/example/manual", {
        orgId: authData.orgId,
        propertyId: req.propertyId,
        date: req.date,
      });
      
      // Step 5: Record metrics
      const ttfbMs = timer.getElapsedMs();
      recordMetric(
        "/v1/example/manual",
        ttfbMs,
        compression.compressedSize,
        200,
        compression.wasCompressed,
        compression.compressionRatio,
        false,
        false
      );
      
      // Return response with all headers for logging
      return {
        ...data,
        _headers: {
          ...conditionalResult.headers,
          ...cacheHeaders,
          'Server-Timing': `total;dur=${ttfbMs.toFixed(2)}`,
        },
      };
    } catch (error) {
      recordMetric("/v1/example/manual", timer.getElapsedMs(), 0, 500);
      throw error;
    }
  }
);

// ============================================================================
// EXAMPLE 4: Updating Last-Modified on write operations
// ============================================================================

interface WriteRequest {
  propertyId: number;
  data: unknown;
}

/**
 * Example: Write endpoint that updates Last-Modified timestamp
 * 
 * Always update Last-Modified when data changes so GET endpoints
 * can properly respond with 304.
 */
export const exampleWriteWithLastModified = api<WriteRequest, { id: number }>(
  { auth: true, expose: true, method: "POST", path: "/v1/example/write" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }

    const timer = createRequestTimer("/v1/example/write");
    
    try {
      timer.checkpoint('db');
      // Perform write operation...
      const newId = 123;
      
      // Update Last-Modified for this entity type
      // This enables 304 responses for subsequent GET requests
      updateLastModified(authData.orgId, 'properties', req.propertyId);
      
      const ttfbMs = timer.getElapsedMs();
      recordMetric("/v1/example/write", ttfbMs, 50, 200);
      
      return { id: newId };
    } catch (error) {
      recordMetric("/v1/example/write", timer.getElapsedMs(), 0, 500);
      throw error;
    }
  }
);

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/**
 * HOW TO MIGRATE AN EXISTING ENDPOINT
 * 
 * 1. Add conditional GET headers to request type:
 *    ```
 *    interface MyRequest {
 *      // existing fields...
 *      ifNoneMatch?: Header<"If-None-Match">;
 *      ifModifiedSince?: Header<"If-Modified-Since">;
 *      acceptEncoding?: Header<"Accept-Encoding">;
 *    }
 *    ```
 * 
 * 2. Wrap your handler with withNetworkingOptimizations:
 *    ```
 *    const result = await withNetworkingOptimizations(
 *      {
 *        path: "/v1/my/endpoint",
 *        acceptEncoding: req.acceptEncoding,
 *        ifNoneMatch: req.ifNoneMatch,
 *        orgId: authData.orgId,
 *        propertyId: req.propertyId,
 *        entityType: 'my_entity_type',
 *      },
 *      async (timer) => {
 *        // Your existing logic here
 *        timer.checkpoint('db');
 *        const data = await fetchData();
 *        return data;
 *      }
 *    );
 *    ```
 * 
 * 3. For write endpoints, add Last-Modified updates:
 *    ```
 *    updateLastModified(authData.orgId, 'my_entity_type', entityId);
 *    ```
 * 
 * 4. Test with conditional GET headers:
 *    ```
 *    curl -H "If-None-Match: \"abc123\"" /v1/my/endpoint
 *    ```
 */

